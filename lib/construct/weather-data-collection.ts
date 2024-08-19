import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { Rule, Schedule } from "aws-cdk-lib/aws-events";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";

// 引数で渡す情報の定義
export interface WeatherDataCollectionProps {
  locationTable: dynamodb.ITable;
  databaseName: string;
  weatherTableName: string;
}

export class WeatherDataCollection extends Construct {
  constructor(scope: Construct, id: string, props: WeatherDataCollectionProps) {
    super(scope, id);

    // Role for Lambda which query device locations from DynamoDB and writes to Timestream
    const weatherDataCollectionLambdaRole = new iam.Role(
      this,
      "weatherDataLambdaRole",
      {
        assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      },
    );

    props.locationTable.grantReadData(weatherDataCollectionLambdaRole);

    // Grant Timestream write permission
    weatherDataCollectionLambdaRole.attachInlinePolicy(
      new iam.Policy(this, "weatherDataLambdaWriteTimestream", {
        statements: [
          new iam.PolicyStatement({
            actions: ["timestream:WriteRecords"],
            effect: iam.Effect.ALLOW,
            resources: [
              `arn:aws:timestream:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:database/${props.databaseName}/table/${props.weatherTableName}`,
            ],
          }),
        ],
      }),
    );
    weatherDataCollectionLambdaRole.attachInlinePolicy(
      new iam.Policy(this, "weatherDataLambdaDescribeEndpointTimestream", {
        statements: [
          new iam.PolicyStatement({
            actions: ["timestream:DescribeEndpoints"],
            effect: iam.Effect.ALLOW,
            resources: [`*`],
          }),
        ],
      }),
    );
    weatherDataCollectionLambdaRole.attachInlinePolicy(
      new iam.Policy(this, "weatherDataLambdaDecryptKMS", {
        statements: [
          new iam.PolicyStatement({
            actions: ["kms:Decrypt"],
            effect: iam.Effect.ALLOW,
            resources: [`*`],
          }),
        ],
      }),
    );
    const OpenWeatherMapApiSecret = new secretsmanager.Secret(
      this,
      "OpenWeatherMapApiSecret",
    );
    OpenWeatherMapApiSecret.grantRead(weatherDataCollectionLambdaRole);

    // Lambda layer for OpenWeatherMap related libraries
    const OpenWeatherMaplambdaLayer = new lambda.LayerVersion(
      this,
      "OpenWeatherMaplambdaLayer",
      {
        code: lambda.AssetCode.fromAsset("lib/lambda/layer/open-weather-map"),
        compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
      },
    );

    // Lambda to get weather data from OpenWeatherMap API and write to Timestream
    const weatherDataCollectionLambda = new lambda.Function(
      this,
      "weatherDataCollectionLambda",
      {
        runtime: lambda.Runtime.PYTHON_3_12,
        code: lambda.Code.fromAsset(
          "lib/lambda/external-data-collection/open-weather-map",
        ),
        handler: "index.handler",
        role: weatherDataCollectionLambdaRole,
        logRetention: RetentionDays.ONE_MONTH,
        environment: {
          LOG_LEVEL: "INFO",
          DYNAMODB_TABLE_NAME: props.locationTable.tableName,
          TIMESTREAM_DB_NAME: props.databaseName,
          TIMESTREAM_TABLE_NAME: props.weatherTableName,
          OWM_API_TOKEN_SECRET_NAME: OpenWeatherMapApiSecret.secretName,
          REGION: cdk.Stack.of(this).region,
        },
        timeout: cdk.Duration.seconds(10),
        layers: [OpenWeatherMaplambdaLayer],
      },
    );
    // Grant logging permission
    weatherDataCollectionLambdaRole.attachInlinePolicy(
      new iam.Policy(this, "weatherDataLambdaLogging", {
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
    // EventBridge rule to trigger Lambda at regular interval
    new Rule(this, "executeWeatherDataCollectionLambda", {
      schedule: Schedule.rate(cdk.Duration.minutes(5)),
      targets: [
        new LambdaFunction(weatherDataCollectionLambda, { retryAttempts: 3 }),
      ],
      enabled: true,
    });

    new cdk.CfnOutput(this, "OpenWeatherMapApiSecretName", {
      value: OpenWeatherMapApiSecret.secretName,
    });
  }
}
