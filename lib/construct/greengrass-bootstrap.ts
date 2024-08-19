import { Stack, CfnOutput, Names } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as iot from "aws-cdk-lib/aws-iot";

enum GreengrassInstallPlatform {
  Windows = 0,
  Linux = 1,
}

export const GREENGRASS_WINDOWS_INSTALL_PATH: string = "C:\\greengrass\\v2";
export const GREENGRASS_LINUX_INSTALL_PATH: string = "/greengrass/v2";
export const GREENGRASS_JAR_PATH: string =
  "/GreengrassInstaller/lib/Greengrass.jar";

export interface GreengrassBootstrapProps {
  /**
   * Buckets for greengrass components to store.
   * @default []
   */
  componentBuckets?: s3.IBucket[];
  /**
   * IoT Thing name.
   */
  thingName?: string;
  /**
   * If `true`, install command output will contain --deploy-dev-tools as `true`.
   * See: https://docs.aws.amazon.com/greengrass/v2/developerguide/configure-installer.html
   * @default false
   */
  deployDevTools?: boolean;
}

export class GreengrassBootstrap extends Construct {
  /**
   * Constructor for Greengrass-related resources.
   * Generates the necessary resources for Greengrass installation.
   */
  private readonly roleAlias: iot.CfnRoleAlias;
  private readonly thingPolicy: iot.CfnPolicy;
  public readonly thingName: string;
  public readonly tesRole: iam.Role;
  public readonly installPolicy: iam.Policy;

  constructor(scope: Construct, id: string, props: GreengrassBootstrapProps) {
    super(scope, id);

    this.thingName = props.thingName ?? Names.uniqueId(this);
    const deployDevTools = props.deployDevTools ?? false;

    const tesRolePolicy = new iam.Policy(this, "GreengrassTESRolePolicy", {
      statements: [
        new iam.PolicyStatement({
          actions: [
            "iot:Receive",
            "iot:Subscribe",
            "iot:Connect",
            "iot:Publish",
            "iot:DescribeCertificate",
            "logs:CreateLogStream",
            "logs:DescribeLogStreams",
            "logs:CreateLogGroup",
            "logs:PutLogEvents",
            "s3:GetBucketLocation",
          ],
          resources: ["*"],
        }),
      ],
    });

    // If component buckets provided, add get access permission to the bucket.
    if (props.componentBuckets) {
      props.componentBuckets.map((bucket) => {
        bucket.grantRead(tesRolePolicy);
      });
    }

    // Create a role to be assigned to Greengrass.
    const tesRole = new iam.Role(this, `GreengrassTESRole`, {
      assumedBy: new iam.ServicePrincipal("credentials.iot.amazonaws.com"),
    });
    tesRole.attachInlinePolicy(tesRolePolicy);

    const roleAlias = new iot.CfnRoleAlias(this, "GreengrassRoleAlias", {
      roleArn: tesRole.roleArn,
      roleAlias: `${tesRole.roleName}Alias`,
    });

    // Create an IoT Thing policy to be assigned to Greengrass.
    const thingPolicy = new iot.CfnPolicy(this, "GreengrassThingPolicy", {
      policyName: `${this.thingName}ThingPolicy`,
      policyDocument: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            actions: [
              "iot:Connect",
              "iot:Publish",
              "iot:Subscribe",
              "iot:Receive",
              "greengrass:*",
              "iot:DeleteThingShadow",
              "iot:GetThingShadow",
              "iot:UpdateThingShadow",
            ],
            resources: ["*"],
          }),
        ],
      }),
    });

    // Create a policy to be assigned to IAM for Greengrass installation.
    const installerIamPolicyStatement = new iam.PolicyStatement({
      actions: [
        "iam:AttachRolePolicy",
        "iam:CreatePolicy",
        "iam:CreateRole",
        "iam:GetPolicy",
        "iam:GetRole",
        "iam:PassRole",
      ],
      resources: [
        `arn:aws:iam::${Stack.of(this).account}:role/${tesRole.roleName}`,
        `arn:aws:iam::${Stack.of(this).account}:policy/${
          tesRole.roleName
        }Access`,
      ],
    });

    // Required iam policy which required by install.
    const installerIoTPolicyStatement = new iam.PolicyStatement({
      actions: [
        "iot:AddThingToThingGroup",
        "iot:AttachPolicy",
        "iot:AttachThingPrincipal",
        "iot:CreateKeysAndCertificate",
        "iot:CreatePolicy",
        "iot:CreateRoleAlias",
        "iot:CreateThing",
        "iot:CreateThingGroup",
        "iot:DescribeEndpoint",
        "iot:DescribeRoleAlias",
        "iot:DescribeThingGroup",
        "iot:GetPolicy",
        "greengrass:CreateDeployment",
        "iot:CancelJob",
        "iot:CreateJob",
        "iot:DeleteThingShadow",
        "iot:DescribeJob",
        "iot:DescribeThing",
        "iot:DescribeThingGroup",
        "iot:GetThingShadow",
        "iot:UpdateJob",
        "iot:UpdateThingShadow",
      ],
      resources: ["*"],
    });
    const installPolicy = new iam.Policy(this, `GreengrassInstallPolicy`, {
      statements: [installerIamPolicyStatement, installerIoTPolicyStatement],
    });

    this.tesRole = tesRole;
    this.roleAlias = roleAlias;
    this.thingPolicy = thingPolicy;
    this.installPolicy = installPolicy;

    new CfnOutput(this, `Greengrass Install Command for Linux`, {
      value: this.createInstallCommand(
        GREENGRASS_LINUX_INSTALL_PATH,
        GREENGRASS_JAR_PATH,
        GreengrassInstallPlatform.Linux,
        deployDevTools,
      ),
    });
  }

  // Generate Greengrass installation command based on the platform.
  private createInstallCommand(
    installPath: string,
    installerPath: string,
    platform: GreengrassInstallPlatform,
    deployDevTools: boolean,
  ): string {
    const defaultUser =
      platform === GreengrassInstallPlatform.Windows
        ? "ggc_user"
        : "ggc_user:ggc_group";
    const rootExec =
      platform === GreengrassInstallPlatform.Linux ? "sudo -E " : "";

    return `${rootExec}java "-Droot=${installPath}" "-Dlog.store=FILE"  -jar .${installerPath} --aws-region ${
      Stack.of(this).region
    }  --thing-name ${this.thingName} --thing-policy-name ${this.thingPolicy
      .policyName!} --tes-role-name  ${
      this.tesRole.roleName
    } --tes-role-alias-name ${this.roleAlias
      .roleAlias!} --component-default-user ${defaultUser} --provision true --setup-system-service true --deploy-dev-tools ${deployDevTools}`;
  }
}
