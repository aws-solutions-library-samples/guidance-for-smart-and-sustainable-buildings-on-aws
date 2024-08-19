import * as cdk from "aws-cdk-lib";
import { AwsSolutionsChecks, NagSuppressions } from "cdk-nag";
import { Aspects } from "aws-cdk-lib";
import { SustainableBuilding } from "../lib/data-collection";
import { GreengrassStack } from "../lib/greengrass-stack";

const app = new cdk.App();

// Add the cdk-nag AwsSolutions Pack with extra verbose logging enabled.
Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

const sustainableBuildingStack = new SustainableBuilding(
  app,
  "SustainableBuilding",
  {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.AWS_REGION,
    },
  },
);

const greengrassStack = new GreengrassStack(app, "GreengrassStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.AWS_REGION,
  },
});

addNagSuppressionsForStacks(sustainableBuildingStack, greengrassStack);

function addNagSuppressionsForStacks(
  sustainableBuildingStack: SustainableBuilding,
  greengrassStack: GreengrassStack,
) {
  // Suppress Nag checks for both stacks
  NagSuppressions.addResourceSuppressions(
    [sustainableBuildingStack, greengrassStack],
    [
      {
        id: "AwsSolutions-IAM5",
        reason:
          "Wildcard permissions are required for the Lambda function to access Timestream resources.",
        appliesTo: ["Action::timestream:DescribeEndpoints", "Resource::*"],
      },
      {
        id: "AwsSolutions-IAM5",
        reason:
          "Wildcard permissions are required for the Lambda function to access Timestream resources.",
        appliesTo: [
          "Action::logs:CreateLogGroup",
          "Action::logs:CreateLogStream",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          `Resource::arn:aws:logs:${process.env.AWS_REGION}:${process.env.CDK_DEFAULT_ACCOUNT}:log-group:/aws/lambda/*`,
        ],
      },
    ],
    true,
  );

  // Suppress Nag checks specific to the SustainableBuilding stack
  NagSuppressions.addResourceSuppressions(
    [sustainableBuildingStack],
    [
      {
        id: "AwsSolutions-IAM5",
        reason:
          "Wildcard permissions are required for the Lambda function to access IoT resources.",
        appliesTo: [
          "Action::iot:GetThingShadow",
          "Action::iot:UpdateThingShadow",
          "iot:DeleteThingShadow",
          `Resource::arn:aws:iot:${process.env.AWS_REGION}:${process.env.CDK_DEFAULT_ACCOUNT}:*`,
        ],
      },
    ],
    true,
  );

  // Suppress Nag checks specific to the GreengrassStack
  NagSuppressions.addResourceSuppressions(
    [greengrassStack],
    [
      {
        id: "AwsSolutions-IAM5",
        reason:
          "Wildcard permissions are required for the GreengrassTESRole to access the Greengrass component bucket",
        appliesTo: [
          "Action::s3:GetBucket*",
          "Action::s3:GetObject*",
          "Action::s3:List*",
          `Resource::*`,
        ],
      },
    ],
    true,
  );

  // Suppress Nag checks for specific resources in the GreengrassStack
  NagSuppressions.addResourceSuppressionsByPath(
    greengrassStack,
    [
      "/GreengrassStack/SensingDevice1/GreengrassTESRolePolicy/Resource",
      "/GreengrassStack/SensingDevice2/GreengrassTESRolePolicy/Resource",
      "/GreengrassStack/sensorDataCollectionComponentPublish/Project/Role/DefaultPolicy/Resource",
      "/GreengrassStack/automateVentilationComponentPublish/Project/Role/DefaultPolicy/Resource",
    ],
    [
      {
        id: "AwsSolutions-IAM5",
        reason:
          "Wildcard permissions are required for the GreengrassTESRole to access the resources.",
      },
    ],
  );

  NagSuppressions.addResourceSuppressions(
    greengrassStack,
    [
      {
        id: "AwsSolutions-IAM5",
        reason:
          "Custom resource handler requires access to all versions of Greengrass components for publishing.",
        appliesTo: [
          `Resource::arn:aws:greengrass:${process.env.AWS_REGION}:${process.env.CDK_DEFAULT_ACCOUNT}:components:automateVentilation:versions:*`,
          `Resource::arn:aws:greengrass:${process.env.AWS_REGION}:${process.env.CDK_DEFAULT_ACCOUNT}:components:collectSensorData:versions:*`,
        ],
      },
    ],
    true,
  );

  NagSuppressions.addResourceSuppressions(
    sustainableBuildingStack,
    [
      {
        id: "AwsSolutions-TS3",
        reason:
          "Using AWS Managed Key for Timestream database encryption is sufficient for our current security requirements.",
      },
    ],
    true,
  );

  NagSuppressions.addResourceSuppressionsByPath(
    sustainableBuildingStack,
    [
      "/SustainableBuilding/WeatherDataCollection/OpenWeatherMapApiSecret/Resource",
      "/SustainableBuilding/PowerDataCollection/switchBotApiSecret/Resource",
    ],
    [
      {
        id: "AwsSolutions-SMG4",
        reason:
          "The secret does not require automatic rotation as it is an external API key.",
      },
    ],
  );

  NagSuppressions.addStackSuppressions(sustainableBuildingStack, [
    {
      id: "AwsSolutions-IAM4",
      reason: "The policy is attached by CDK.",
      appliesTo: [
        "Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
        "Policy::arn:<AWS::Partition>:iam::aws:policy/CloudWatchLambdaInsightsExecutionRolePolicy",
      ],
    },
  ]);

  NagSuppressions.addStackSuppressions(greengrassStack, [
    {
      id: "AwsSolutions-IAM4",
      reason: "The policy is attached by CDK.",
      appliesTo: [
        "Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
      ],
    },
  ]);
}
