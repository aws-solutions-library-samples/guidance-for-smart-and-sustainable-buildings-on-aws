import * as cdk from "aws-cdk-lib";
import { CfnDatabase, CfnTable } from "aws-cdk-lib/aws-timestream";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

export interface DatastoreProps {
  databaseName: string;
  sensorTableName: string;
  powerTableName: string;
  weatherTableName: string;
}

export class DataStore extends Construct {
  public readonly sustainableBuildingDB: CfnDatabase;
  public readonly sensorTable: CfnTable;
  public readonly powerTable: CfnTable;
  public readonly weatherTable: CfnTable;
  public readonly locationTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DatastoreProps) {
    super(scope, id);

    //////////////////////////////////////////////
    // Amazon Timestream Configuration
    //////////////////////////////////////////////

    // Create database
    this.sustainableBuildingDB = new CfnDatabase(this, "sustainableBuilding", {
      databaseName: props.databaseName,
    });

    // Table to store sensor data
    this.sensorTable = new CfnTable(this, "sensor", {
      tableName: props.sensorTableName,
      databaseName: props.databaseName,
      retentionProperties: {
        memoryStoreRetentionPeriodInHours: 72,
        magneticStoreRetentionPeriodInDays: 90,
      },
    });
    this.sensorTable.node.addDependency(this.sustainableBuildingDB);

    // Table for storing power consumption data
    this.powerTable = new CfnTable(this, "power", {
      tableName: props.powerTableName,
      databaseName: props.databaseName,
      retentionProperties: {
        memoryStoreRetentionPeriodInHours: 72,
        magneticStoreRetentionPeriodInDays: 90,
      },
    });
    this.powerTable.node.addDependency(this.sustainableBuildingDB);

    // Table for storing weather data
    this.weatherTable = new CfnTable(this, "weather", {
      tableName: props.weatherTableName,
      databaseName: props.databaseName,
      retentionProperties: {
        memoryStoreRetentionPeriodInHours: 72,
        magneticStoreRetentionPeriodInDays: 90,
      },
    });
    this.weatherTable.node.addDependency(this.sustainableBuildingDB);

    //////////////////////////////////////////////
    // Amazon DynamoDB Configuration
    //////////////////////////////////////////////
    // Table for storing device location info
    this.locationTable = new dynamodb.Table(this, "location", {
      partitionKey: { name: "Location", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
    });
    new cdk.CfnOutput(this, "locationTable", {
      value: this.locationTable.tableName,
    });
  }
}
