import os
import boto3
from botocore.config import Config
import time
import json

# Initialize AWS services
REGION_NAME = os.environ["REGION"]
session = boto3.Session()

dynamodb_resource = session.resource("dynamodb")
timestream_client = session.client(
    "timestream-write", config=Config(max_pool_connections=20)
)

# Fetch environment variables
TIMESTREAM_DB_NAME = os.environ["TIMESTREAM_DB_NAME"]
TIMESTREAM_TABLE_NAME = os.environ["TIMESTREAM_TABLE_NAME"]
DYNAMODB_TABLE_NAME = os.environ["DYNAMODB_TABLE_NAME"]

dynamodb_table = dynamodb_resource.Table(DYNAMODB_TABLE_NAME)


def handler(event, context):
    # Fetch location list from DynamoDB
    locations = dynamodb_table.scan()["Items"]
    print(f"Location list: {locations}")

    for location in locations:
        # Check if the device is registered in the location list
        if event["DEVICE_NAME"] == location["Devices"]["Main"]:
            measure_values = [
                {
                    "Name": "TEMPERATURE",
                    "Value": str(float(event["TEMPERATURE"])),
                    "Type": "DOUBLE",
                },
                {
                    "Name": "HUMIDITY",
                    "Value": str(float(event["HUMIDITY"])),
                    "Type": "DOUBLE",
                },
                {"Name": "CO2", "Value": str(float(event["CO2"])), "Type": "DOUBLE"},
                {
                    "Name": "PRESSURE",
                    "Value": str(float(event["PRESSURE"])),
                    "Type": "DOUBLE",
                },
                {"Name": "LOCATION", "Value": str(location["Name"]), "Type": "VARCHAR"},
            ]

            record = {
                "Dimensions": [
                    {"Name": "DeviceName", "Value": location["Devices"]["Main"]}
                ],
                "MeasureName": "sustainability_sensor",
                "MeasureValueType": "MULTI",
                "MeasureValues": measure_values,
                "Time": str(round(time.time() * 1000)),
                "TimeUnit": "MILLISECONDS",
            }

            try:
                timestream_client.write_records(
                    DatabaseName=TIMESTREAM_DB_NAME,
                    TableName=TIMESTREAM_TABLE_NAME,
                    Records=[record],
                )
                print(f'Successfully wrote data for {location["Name"]} to Timestream')
            except Exception as e:
                print(f'Error writing data for {location["Name"]} to Timestream: {e}')

    return {"statusCode": 200, "body": json.dumps("Stored to timestream")}
