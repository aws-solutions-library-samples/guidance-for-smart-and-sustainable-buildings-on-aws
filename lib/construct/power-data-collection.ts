import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { Rule, Schedule } from "aws-cdk-lib/aws-events";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";

export interface PowerDataCollectionProps {
  locationTable: dynamodb.ITable;
  databaseName: string;
  powerTableName: string;
}

export class PowerDataCollection extends Construct {
  constructor(scope: Construct, id: string, props: PowerDataCollectionProps) {
    super(scope, id);

    // Role for Lambda which query device locations from DynamoDB and writes to Timestream
    const powerDataCollectionLambdaRole = new iam.Role(
      this,
      "powerDataCollectionLambdaRole",
      {
        assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      },
    );

    props.locationTable.grantReadData(powerDataCollectionLambdaRole);
    // Grant logging permission
    powerDataCollectionLambdaRole.attachInlinePolicy(
      new iam.Policy(this, "powerDataCollectionLambdaLogging", {
        statements: [
          new iam.PolicyStatement({
            actions: [
              "logs:CreateLogGroup",
              "logs:CreateLogStream",
              "logs:PutLogEvents",
            ],
            effect: iam.Effect.ALLOW,
            resources: [
              `arn:aws:logs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:log-group:/aws/lambda/*`,
            ],
          }),
        ],
      }),
    );
    // Grant Timestream write permission
    powerDataCollectionLambdaRole.attachInlinePolicy(
      new iam.Policy(this, "powerDataCollectionLambdaWriteTimestream", {
        statements: [
          new iam.PolicyStatement({
            actions: ["timestream:WriteRecords"],
            effect: iam.Effect.ALLOW,
            resources: [
              `arn:aws:timestream:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:database/${props.databaseName}/table/${props.powerTableName}`,
            ],
          }),
        ],
      }),
    );
    powerDataCollectionLambdaRole.attachInlinePolicy(
      new iam.Policy(
        this,
        "powerDataCollectionLambdaDescribeEndpointTimestream",
        {
          statements: [
            new iam.PolicyStatement({
              actions: ["timestream:DescribeEndpoints"],
              effect: iam.Effect.ALLOW,
              resources: [`*`],
            }),
          ],
        },
      ),
    );
    powerDataCollectionLambdaRole.attachInlinePolicy(
      new iam.Policy(this, "powerDataCollectionLambdaDecryptKMS", {
        statements: [
          new iam.PolicyStatement({
            actions: ["kms:Decrypt"],
            effect: iam.Effect.ALLOW,
            resources: [`*`],
          }),
        ],
      }),
    );
    const switchBotApiSecret = new secretsmanager.Secret(
      this,
      "switchBotApiSecret",
    );
    switchBotApiSecret.grantRead(powerDataCollectionLambdaRole);

    // Lambda layer for SwitchBot related libraries
    const powerDataCollectionLayer = new lambda.LayerVersion(
      this,
      "powerDataCollectionLayer",
      {
        code: lambda.AssetCode.fromAsset("lib/lambda/layer/requests"),
        compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
      },
    );

    // Lambda to get power consumption data from SwitchBot API and write to Timestream
    const powerDataCollectionLambda = new lambda.Function(
      this,
      "powerDataCollectionLambda",
      {
        runtime: lambda.Runtime.PYTHON_3_12,
        code: lambda.Code.fromAsset(
          "lib/lambda/external-data-collection/power/switchbot",
        ),
        handler: "index.handler",
        role: powerDataCollectionLambdaRole,
        logRetention: RetentionDays.ONE_MONTH,
        environment: {
          LOG_LEVEL: "INFO",
          DYNAMODB_TABLE_NAME: props.locationTable.tableName,
          TIMESTREAM_DB_NAME: props.databaseName,
          TIMESTREAM_TABLE_NAME: props.powerTableName,
          SWITCHBOT_API_TOKEN_SECRET_NAME: switchBotApiSecret.secretName,
          REGION: cdk.Stack.of(this).region,
        },
        timeout: cdk.Duration.seconds(10),
        tracing: lambda.Tracing.ACTIVE,
        insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_229_0,
        layers: [powerDataCollectionLayer],
      },
    );

    // EventBridge rule to trigger Lambda at regular interval
    new Rule(this, "executepowerDataCollectionCollectionLambda", {
      schedule: Schedule.rate(cdk.Duration.minutes(1)),
      targets: [
        new LambdaFunction(powerDataCollectionLambda, { retryAttempts: 3 }),
      ],
      enabled: true,
    });

    new cdk.CfnOutput(this, "switchBotApiSecretName", {
      value: switchBotApiSecret.secretName,
    });
  }
}
