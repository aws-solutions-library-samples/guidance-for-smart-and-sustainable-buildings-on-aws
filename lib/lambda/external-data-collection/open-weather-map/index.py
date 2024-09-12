import os
import boto3
from botocore.config import Config
from pyowm import OWM
from pyowm.utils.config import get_default_config

# Initialize AWS services
REGION_NAME = os.environ["REGION"]
session = boto3.Session()

secrets_manager_client = session.client("secretsmanager", region_name=REGION_NAME)
dynamodb_resource = session.resource("dynamodb")
timestream_client = session.client(
    "timestream-write", config=Config(max_pool_connections=5)
)

# Fetch secrets and environment variables
OWM_API_TOKEN_SECRET_NAME = os.environ["OWM_API_TOKEN_SECRET_NAME"]
TIMESTREAM_DB_NAME = os.environ["TIMESTREAM_DB_NAME"]
TIMESTREAM_TABLE_NAME = os.environ["TIMESTREAM_TABLE_NAME"]
DYNAMODB_TABLE_NAME = os.environ["DYNAMODB_TABLE_NAME"]

try:
    owm_api_key = secrets_manager_client.get_secret_value(
        SecretId=OWM_API_TOKEN_SECRET_NAME
    )["SecretString"]
except Exception as e:
    raise e

dynamodb_table = dynamodb_resource.Table(DYNAMODB_TABLE_NAME)

# Configure PyOWM
pyowm_config = get_default_config()
pyowm_config["language"] = "ja"
owm = OWM(owm_api_key, pyowm_config)


def handler(event, context):
    locations = dynamodb_table.scan()["Items"]

    for location in [loc for loc in locations if loc["Valid"]]:
        lat, lon, name = (
            float(location["Lat"]),
            float(location["Lon"]),
            location["Name"],
        )
        print(f"Initializing OpenWeatherMap for {name} at {lat}, {lon}...\n")

        mgr = owm.weather_manager()
        observation = mgr.weather_at_coords(lat, lon)
        weather = observation.weather

        measure_values = [
            {
                "Name": "WEATHER_CODE",
                "Value": str(weather.weather_code),
                "Type": "VARCHAR",
            },
            {"Name": "STATUS", "Value": str(weather.status), "Type": "VARCHAR"},
            {
                "Name": "DETAILED_STATUS",
                "Value": str(weather.detailed_status),
                "Type": "VARCHAR",
            },
            {
                "Name": "TEMP",
                "Value": str(weather.temperature("celsius")["temp"]),
                "Type": "DOUBLE",
            },
            {
                "Name": "HUMIDITY",
                "Value": str(float(weather.humidity)),
                "Type": "DOUBLE",
            },
            {
                "Name": "BAROMETRIC_PRESSURE",
                "Value": str(weather.barometric_pressure()["press"]),
                "Type": "DOUBLE",
            },
            {"Name": "LAT", "Value": str(lat), "Type": "DOUBLE"},
            {"Name": "LON", "Value": str(lon), "Type": "DOUBLE"},
        ]

        record = {
            "Dimensions": [{"Name": "location", "Value": name}],
            "MeasureName": "openweathermap",
            "MeasureValueType": "MULTI",
            "MeasureValues": measure_values,
            "Time": str(round(weather.ref_time * 1000)),
            "TimeUnit": "MILLISECONDS",
        }

        try:
            timestream_client.write_records(
                DatabaseName=TIMESTREAM_DB_NAME,
                TableName=TIMESTREAM_TABLE_NAME,
                Records=[record],
            )
            print(f"Successfully wrote weather data for {name} to Timestream")
        except Exception as e:
            print(f"Error writing weather data for {name} to Timestream: {e}")

    return "Finished writing to Timestream"
