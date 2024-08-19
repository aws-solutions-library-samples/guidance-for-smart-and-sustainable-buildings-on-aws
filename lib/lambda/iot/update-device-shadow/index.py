import os
import json
import boto3

# Initialize AWS services
REGION_NAME = os.environ["REGION"]
session = boto3.Session()

iot_client = session.client("iot", region_name=REGION_NAME)

# Get IoT-DATA ATS Endpoint
response = iot_client.describe_endpoint(endpointType="iot:Data-ATS")
iot_data_ats_endpoint_url = f'https://{response["endpointAddress"]}'


def handler(event, context):
    print(f"Event: {event}")
    iot_data_client = session.client(
        "iot-data", endpoint_url=iot_data_ats_endpoint_url, region_name=REGION_NAME
    )

    device_name = event["DEVICE_NAME"]

    if not isinstance(event["CO2"], (int, float)):
        return {"statusCode": 200, "body": json.dumps("CO2 Value is Empty")}

    co2_value = float(event["CO2"])
    need_ventilate = co2_value >= 800

    shadow_doc = {"state": {"reported": {"ventilate": need_ventilate}}}
    payload = json.dumps(shadow_doc)

    iot_data_client.update_thing_shadow(thingName=device_name, payload=payload)

    return {"statusCode": 200, "body": json.dumps("Updated Device Shadow")}
