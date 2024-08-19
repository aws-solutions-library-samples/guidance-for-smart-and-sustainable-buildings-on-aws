import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import * as iot from "@aws-cdk/aws-iot-alpha";
import * as iotactions from "@aws-cdk/aws-iot-actions-alpha";

export interface SensorDataCollecionProps {
  locationTable: dynamodb.ITable;
  databaseName: string;
  sensorTableName: string;
}

export class SensorDataCollection extends Construct {
  constructor(scope: Construct, id: string, props: SensorDataCollecionProps) {
    super(scope, id);

    // Role for Lambda which query device locations from DynamoDB and writes to Timestream
    const sensorDataCollectionLambdaRole = new iam.Role(
      this,
      "sensorDataCollectionLambdaRole",
      {
        assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      },
    );

    props.locationTable.grantReadData(sensorDataCollectionLambdaRole);
    // Grant logging permission
    sensorDataCollectionLambdaRole.attachInlinePolicy(
      new iam.Policy(this, "sensorDataLambdaLogging", {
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
    sensorDataCollectionLambdaRole.attachInlinePolicy(
      new iam.Policy(this, "sensorDataLambdaWriteTimestream", {
        statements: [
          new iam.PolicyStatement({
            actions: ["timestream:WriteRecords"],
            effect: iam.Effect.ALLOW,
            resources: [
              `arn:aws:timestream:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:database/${props.databaseName}/table/${props.sensorTableName}`,
            ],
          }),
        ],
      }),
    );
    sensorDataCollectionLambdaRole.attachInlinePolicy(
      new iam.Policy(this, "sensorDataLambdaDescribeEndpointTimestream", {
        statements: [
          new iam.PolicyStatement({
            actions: ["timestream:DescribeEndpoints"],
            effect: iam.Effect.ALLOW,
            resources: [`*`],
          }),
        ],
      }),
    );
    // Lambda which query device locations from DynamoDB and writes to Timestream
    const sensorDataCollectionLambda = new lambda.Function(
      this,
      "sensorDataCollectionLambda",
      {
        runtime: lambda.Runtime.PYTHON_3_12,
        code: lambda.Code.fromAsset("lib/lambda/iot/sensor-data-collection"),
        handler: "index.handler",
        role: sensorDataCollectionLambdaRole,
        logRetention: RetentionDays.ONE_MONTH,
        environment: {
          LOG_LEVEL: "INFO",
          DYNAMODB_TABLE_NAME: props.locationTable.tableName,
          TIMESTREAM_DB_NAME: props.databaseName,
          TIMESTREAM_TABLE_NAME: props.sensorTableName,
          REGION: cdk.Stack.of(this).region,
        },
        timeout: cdk.Duration.seconds(3),
        tracing: lambda.Tracing.ACTIVE,
        insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_229_0,
      },
    );

    // IoT Rule
    new iot.TopicRule(this, "executeSensorDataCollectionLambda", {
      sql: iot.IotSql.fromStringAsVer20160323(
        `SELECT TEMPERATURE, HUMIDITY, POWER, DEVICE_NAME, CO2, PRESSURE, TIMESTAMP from 'sensor/#'`,
      ),
      actions: [
        new iotactions.LambdaFunctionAction(sensorDataCollectionLambda),
      ],
    });

    // Role for Lambda which updates device shadow based on sensor data value
    const updateDeviceShadowLambdaRole = new iam.Role(
      this,
      "updateDeviceShadowLambdaRole",
      {
        assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      },
    );

    // Grant logging permission
    updateDeviceShadowLambdaRole.attachInlinePolicy(
      new iam.Policy(this, "updateDeviceShadowLambdaLogging", {
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
    // Grant permission to update DeviceShadow
    updateDeviceShadowLambdaRole.attachInlinePolicy(
      new iam.Policy(this, "updateDeviceShadowLambdaUpdateDeviceShadow", {
        statements: [
          new iam.PolicyStatement({
            actions: [
              "iot:GetThingShadow",
              "iot:UpdateThingShadow",
              "iot:DeleteThingShadow",
            ],
            effect: iam.Effect.ALLOW,
            resources: [
              `arn:aws:iot:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:*`,
            ],
          }),
        ],
      }),
    );

    // Grant permission to describe IoT ATS Endpoint
    updateDeviceShadowLambdaRole.attachInlinePolicy(
      new iam.Policy(this, "describeIotAtsEndpointAddress", {
        statements: [
          new iam.PolicyStatement({
            actions: ["iot:DescribeEndpoint"],
            effect: iam.Effect.ALLOW,
            resources: ["*"],
          }),
        ],
      }),
    );

    // Lambda to update device shadow based on sensor data value
    const updateDeviceShadowLambda = new lambda.Function(
      this,
      "updateDeviceShadowLambda",
      {
        runtime: lambda.Runtime.PYTHON_3_12,
        code: lambda.Code.fromAsset("lib/lambda/iot/update-device-shadow"),
        handler: "index.handler",
        role: updateDeviceShadowLambdaRole,
        logRetention: RetentionDays.ONE_MONTH,
        environment: {
          LOG_LEVEL: "INFO",
          REGION: cdk.Stack.of(this).region,
        },
        timeout: cdk.Duration.seconds(10),
        tracing: lambda.Tracing.ACTIVE,
        insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_229_0,
      },
    );
    // IoT Rule
    new iot.TopicRule(this, "executeUpdateDeviceShadowLambda", {
      sql: iot.IotSql.fromStringAsVer20160323(
        `SELECT DEVICE_NAME, CO2, TIMESTAMP from 'sensor/#'`,
      ),
      actions: [new iotactions.LambdaFunctionAction(updateDeviceShadowLambda)],
    });
  }
}
