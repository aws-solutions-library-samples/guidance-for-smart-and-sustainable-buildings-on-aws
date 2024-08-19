import os
import time
import datetime
import sys
import subprocess
import logging
import json
from lib.bme280 import BME280
import awsiot.greengrasscoreipc.clientv2 as clientV2

# Logger Configuration
logger = logging.getLogger()
handler = logging.StreamHandler(sys.stdout)
logger.addHandler(handler)
logger.setLevel(logging.DEBUG)
logging.basicConfig()
logger.info("==================== [App Initialized] ====================")

PYTHON_VENV_PATH = os.environ["PYTHON_VENV_PATH"]
PYTHON_COMMAND_PATH = os.path.join(PYTHON_VENV_PATH, "bin/python3")
DEVICE_NAME = os.environ["AWS_IOT_THING_NAME"]
TOPIC = f"sensor/{DEVICE_NAME}"
QOS = "1"
INTERVAL = 10


def read_co2_data():
    """Read CO2 data from the MH-Z19 sensor"""
    try:
        co2_data_raw = subprocess.check_output(
            ["sudo", PYTHON_COMMAND_PATH, "-m", "mh_z19"]
        )
        co2_data = json.loads(co2_data_raw.decode("utf-8"))
        logger.info(f"CO2: {co2_data}")

        if co2_data and "co2" in co2_data:
            return co2_data["co2"]
        else:
            return ""
    except Exception as e:
        logger.error(f"Error reading CO2 data: {e}")
        return ""


def publish_to_iot_core(data):
    """Publish data to AWS IoT Core"""
    try:
        ipc_client = clientV2.GreengrassCoreIPCClientV2()
        message_json = json.dumps(data)
        ipc_client.publish_to_iot_core(topic_name=TOPIC, qos=QOS, payload=message_json)
    except Exception as e:
        logger.error(f"Error publishing to IoT Core: {e}")
    finally:
        ipc_client.close()


def main():
    try:
        bme280 = BME280()
        bme280.setup()
        bme280.get_calib_param()

        while True:
            sensor_data = bme280.read_data()
            co2_data = read_co2_data()

            now = datetime.datetime.now()
            timestamp = now.strftime("%Y%m%d%H%M%S")

            message = {
                "DEVICE_NAME": DEVICE_NAME,
                "TIMESTAMP": timestamp,
                "TEMPERATURE": sensor_data["temperature"],
                "HUMIDITY": sensor_data["humidity"],
                "PRESSURE": sensor_data["pressure"],
                "CO2": co2_data,
            }
            logger.info(message)

            publish_to_iot_core(message)

            time.sleep(INTERVAL)

    except Exception:
        logger.error("Exception occurred", exc_info=True)

    finally:
        logger.info("==================== [App Stopped] ====================")


if __name__ == "__main__":
    main()
