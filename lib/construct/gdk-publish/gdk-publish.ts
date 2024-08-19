import { Bucket, IBucket } from "aws-cdk-lib/aws-s3";
import { Asset, AssetProps } from "aws-cdk-lib/aws-s3-assets";
import * as path from "path";
import { BuildSpec, LinuxBuildImage, Project } from "aws-cdk-lib/aws-codebuild";
import { Key } from "aws-cdk-lib/aws-kms";
import { Construct } from "constructs";
import {
  Annotations,
  CfnResource,
  CustomResource,
  Duration,
  RemovalPolicy,
  Stack,
} from "aws-cdk-lib";
import {
  Code,
  Runtime,
  RuntimeFamily,
  SingletonFunction,
} from "aws-cdk-lib/aws-lambda";
import { PolicyStatement, Effect, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { GdkBucket } from "./gdk-bucket";
import { GdkConfig } from "./gdk-config";

export type ResourceProperties = {
  sourceBucketName: string;
  sourceObjectKey: string;
  extractPath: string;
  codeBuildProjectName: string;
  componentName: string;
  environment?: { [key: string]: string };
};

export interface GdkPublishProps {
  /**
   * Source asset for gdk deploy.
   */
  readonly asset: AssetProps;
  /**
   * Bucket for greengrass components to store.
   * If not provided, CDK will automatically read "gdk-config.json" and create the bucket automatically.
   * @default `component.publish.bucket` in `gdk-config.json`
   */
  readonly componentBucket?: IBucket;
  /**
   * CodeBuild building image.
   * @default aws/codebuild/standard:7.0
   */
  readonly buildImage?: string;
  /**
   * CodeBuild runtime version.
   * Ref: https://docs.aws.amazon.com/codebuild/latest/userguide/runtime-versions.html
   * @default {}
   */
  readonly runtimeVersions?: { [key: string]: string };
  /**
   * Version of GDK to build and publish.
   * @default latest
   */
  readonly gdkVersion?: string;
  /**
   * Environment variables injected to the build environment.
   * @default {}
   */
  readonly buildEnvironment?: { [key: string]: string };
}

export class GdkPublish extends Construct {
  public readonly componentBucket: IBucket;
  public readonly componentName: string;
  public readonly componentVersion: string;

  constructor(scope: Construct, id: string, props: GdkPublishProps) {
    super(scope, id);

    const buildImage = props.buildImage ?? "aws/codebuild/standard:7.0";
    const gdkExclude = ["zip-build", "greengrass-build"];
    const exclude = props.asset.exclude
      ? [...props.asset.exclude, ...gdkExclude]
      : gdkExclude;
    const componentBucket =
      props.componentBucket ??
      new GdkBucket(this, "ComponentBucket", {
        gdkConfigPath: path.join(props.asset.path, "gdk-config.json"),
        autoDeleteObjects: true,
        removalPolicy: RemovalPolicy.DESTROY,
      });
    const config = new GdkConfig(
      path.join(props.asset.path, "gdk-config.json"),
    );

    const handler = new SingletonFunction(this, "CustomResourceHandler", {
      // Use raw string to avoid from tightening CDK version requirement
      runtime: new Runtime("nodejs20.x", RuntimeFamily.NODEJS),
      code: Code.fromAsset(
        path.join(__dirname, "../../lambda/gdk-publish/dist/"),
      ),
      handler: "index.handler",
      uuid: "34798742-f562-4fa8-ba7b-467e036cb465", // generated for this construct
      lambdaPurpose: "GdkPublishCustomResourceHandler",
      timeout: Duration.minutes(5),
    });

    // Determine python version used in GDK according to the build image.
    let pythonVersion = "3.7";
    switch (buildImage) {
      case "aws/codebuild/standard:5.0":
      case "aws/codebuild/amazonlinux2-aarch64-standard:2.0":
      case "aws/codebuild/amazonlinux2-x86_64-standard:4.0":
        pythonVersion = "3.9";
        break;
      case "aws/codebuild/standard:6.0":
        pythonVersion = "3.10";
        break;
      case "aws/codebuild/standard:7.0":
      case "aws/codebuild/amazonlinux2-x86_64-standard:5.0":
      case "aws/codebuild/amazonlinux2-aarch64-standard:3.0":
        pythonVersion = "3.11";
        break;
      case "aws/codebuild/standard:7.0":
      case "aws/codebuild/amazonlinux2-x86_64-standard:5.0":
      case "aws/codebuild/amazonlinux2-aarch64-standard:3.0":
        pythonVersion = "3.12";
        break;
      default:
        Annotations.of(this).addError(`Unsupported build image: ${buildImage}`);
    }
    const CodeBuildEncryptionKey = new Key(this, "CodeBuildEncryptionKey", {
      description: "KMS key for encrypting CodeBuild artifacts",
      enableKeyRotation: true,
    });

    const project = new Project(this, "Project", {
      environment: { buildImage: LinuxBuildImage.STANDARD_7_0 },
      encryptionKey: CodeBuildEncryptionKey,
      buildSpec: BuildSpec.fromObject({
        version: "0.2",
        phases: {
          install: {
            "runtime-versions": {
              python: pythonVersion,
              ...props.runtimeVersions,
            },
            commands: [
              // Install gdk cli
              "repoUrl='https://api.github.com/repos/aws-greengrass/aws-greengrass-gdk-cli/tags'",
              props.gdkVersion
                ? `tag=${props.gdkVersion}`
                : 'tag=$(curl -s $repoUrl | sed -n \'s/.*"name": "\\(.*\\)",.*/\\1/p\' | head -n1)',
              `python3 -m pip install -U "git+https://github.com/aws-greengrass/aws-greengrass-gdk-cli.git@$tag"`,
              // Need to add gdk bin location to PATH
              // See: https://docs.aws.amazon.com/greengrass/v2/developerguide/install-greengrass-development-kit-cli.html
              'pythonDir=$(python -c "import sys; import os; print(os.path.dirname(sys.executable))")',
              'export PATH="$pythonDir:$PATH"',
              "gdk -v",
            ],
            // Specify `CONTINUE` to execute subsequent post-build steps even if the installation fails.
            "on-failure": "CONTINUE",
          },
          build: {
            commands: [
              "current_dir=$(pwd)",
              'aws s3 cp "$assetUrl" temp.zip',
              'mkdir -p "$extractPath"',
              'unzip temp.zip -d "$extractPath"',
              "rm temp.zip",
              "ls -la",
              'cd "$extractPath"',
              "gdk component build",
              "gdk component publish",
              "ls -la",
            ],
          },
          post_build: {
            commands: [
              "echo Build completed on `date`",
              `
STATUS='SUCCESS'
if [ $CODEBUILD_BUILD_SUCCEEDING -ne 1 ] # Test if the build is failing
then
STATUS='FAILED'
REASON="GdkPublish failed. See CloudWatch Log stream for the detailed reason: 
https://$AWS_REGION.console.aws.amazon.com/cloudwatch/home?region=$AWS_REGION#logsV2:log-groups/log-group/\\$252Faws\\$252Fcodebuild\\$252F$projectName/log-events/$CODEBUILD_LOG_PATH"
fi
              `,
              'echo "$STATUS"',
              "accountId=$(echo $CODEBUILD_BUILD_ARN | cut -f 5 -d :)",
              'arn="arn:aws:greengrass:$AWS_REGION:$accountId:components:$componentName"',
              'echo "$arn"',
              'latestArn=$(aws greengrassv2 list-component-versions --arn "$arn" --query "componentVersions[0].arn" --output text)',
              'echo "$latestArn"',
              'componentVersion=$(basename "$latestArn" | cut -d":" -f9)',
              "echo $componentVersion",
              `
cat <<EOF > payload.json
{
  "StackId": "$stackId",
  "RequestId": "$requestId",
  "LogicalResourceId":"$logicalResourceId",
  "PhysicalResourceId": "$latestArn",
  "Status": "$STATUS",
  "Reason": "$REASON",
  "Data": {
    "componentVersion": "$componentVersion"
  }
}
EOF
`,
              "cat payload.json",
              'curl -vv -i -X PUT -H \'Content-Type:\' -d "@payload.json" "$responseURL"',
            ],
          },
        },
      }),
    });
    (project.node.defaultChild as CfnResource).addPropertyOverride(
      "Environment.Image",
      buildImage,
    );
    CodeBuildEncryptionKey.addToResourcePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        principals: [new ServicePrincipal("codebuild.amazonaws.com")],
        actions: [
          "kms:Encrypt*",
          "kms:Decrypt*",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey",
        ],
        resources: ["*"],
      }),
    );

    handler.addToRolePolicy(
      new PolicyStatement({
        actions: ["codebuild:StartBuild"],
        resources: [project.projectArn],
      }),
    );
    handler.addToRolePolicy(
      new PolicyStatement({
        resources: [
          `arn:aws:greengrass:${Stack.of(this).region}:${
            Stack.of(this).account
          }:components:${config.componentName}:versions:*`,
        ],

        actions: ["greengrass:DeleteComponent"],
      }),
    );
    componentBucket.grantReadWrite(project);
    project.addToRolePolicy(
      new PolicyStatement({
        resources: ["*"],
        actions: [
          "greengrass:CreateComponentVersion",
          "greengrass:ListComponentVersions",
        ],
      }),
    );

    const asset = new Asset(
      this,
      `Source-${props.asset.path.replace("/", "")}`,
      {
        ...props.asset,
        exclude: exclude,
      },
    );
    asset.grantRead(project);

    // Use the asset bucket that are created by CDK bootstrap to store intermediate artifacts
    const bucket = asset.bucket;
    bucket.grantWrite(project);

    const properties: ResourceProperties = {
      sourceBucketName: asset.s3BucketName,
      sourceObjectKey: asset.s3ObjectKey,
      codeBuildProjectName: project.projectName,
      extractPath: path.basename(props.asset.path),
      componentName: config.componentName,
      environment: props.buildEnvironment,
    };

    const custom = new CustomResource(this, "Resource", {
      serviceToken: handler.functionArn,
      resourceType: "Custom::CDKGdkPublish",
      properties,
    });

    this.componentBucket = componentBucket;
    this.componentName = config.componentName;
    this.componentVersion = custom.getAttString("componentVersion");
  }
}
