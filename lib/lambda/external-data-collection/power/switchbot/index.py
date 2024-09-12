import os
import boto3
from botocore.config import Config
import requests
import time

# Initialize AWS services
REGION_NAME = os.environ["REGION"]
session = boto3.Session()

secrets_manager_client = session.client("secretsmanager", region_name=REGION_NAME)
dynamodb_resource = session.resource("dynamodb")
timestream_client = session.client(
    "timestream-write", config=Config(max_pool_connections=20)
)

# Fetch secrets and environment variables
SWITCHBOT_API_TOKEN_SECRET_NAME = os.environ["SWITCHBOT_API_TOKEN_SECRET_NAME"]
TIMESTREAM_DB_NAME = os.environ["TIMESTREAM_DB_NAME"]
TIMESTREAM_TABLE_NAME = os.environ["TIMESTREAM_TABLE_NAME"]
DYNAMODB_TABLE_NAME = os.environ["DYNAMODB_TABLE_NAME"]

try:
    switchbot_api_key = secrets_manager_client.get_secret_value(
        SecretId=SWITCHBOT_API_TOKEN_SECRET_NAME
    )["SecretString"]
except Exception as e:
    raise e

dynamodb_table = dynamodb_resource.Table(DYNAMODB_TABLE_NAME)
SWITCHBOT_API_ENDPOINT = "https://api.switch-bot.com/v1.0/devices/{device_id}/status"


def process_device(location, device_name, device_id):
    headers = {"Authorization": f"Bearer {switchbot_api_key}"}
    response = requests.get(
        SWITCHBOT_API_ENDPOINT.format(device_id=device_id), headers=headers, timeout=3.5
    )
    print(f"Request for {location['Name']} with {device_id}")

    if response.status_code == 200:
        data = response.json()
        item = data["body"]
        measure_values = [
            {"Name": "VOLTAGE", "Value": str(float(item["voltage"])), "Type": "DOUBLE"},
            {"Name": "WEIGHT", "Value": str(float(item["weight"])), "Type": "DOUBLE"},
            {
                "Name": "ELECTRICITY_OF_DAY",
                "Value": str(float(item["electricityOfDay"])),
                "Type": "DOUBLE",
            },
            {
                "Name": "ELECTRIC_CURRENT",
                "Value": str(float(item["electricCurrent"])),
                "Type": "DOUBLE",
            },
            {"Name": "LOCATION", "Value": location["Name"], "Type": "VARCHAR"},
        ]

        record = {
            "Dimensions": [{"Name": "DeviceName", "Value": device_id}],
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
            print(
                f'Successfully wrote data for {location["Name"]} with {device_id} to Timestream'
            )
        except Exception as e:
            print(
                f'Error writing data for {location["Name"]} with {device_id} to Timestream: {e}'
            )
    else:
        print(
            f"API error for {location['Name']} with {device_id}: {response.status_code}"
        )


def handler(event, context):
    locations = dynamodb_table.scan()["Items"]
    valid_locations = [loc for loc in locations if loc["Valid"]]

    for location in valid_locations:
        devices = location["Devices"]
        for device_name, device_id in devices.items():
            if device_name != "Main":
                process_device(location, device_name, device_id)

    return "Finished writing to Timestream"
