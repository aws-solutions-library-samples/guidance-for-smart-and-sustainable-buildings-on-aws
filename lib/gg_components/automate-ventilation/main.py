from gpiozero import AngularServo
from gpiozero.pins.pigpio import PiGPIOFactory
import sys
import time
import os
import logging
import json
import awsiot.greengrasscoreipc
from awsiot.greengrasscoreipc.model import GetThingShadowRequest

# Logger Configuration
logger = logging.getLogger()
handler = logging.StreamHandler(sys.stdout)
logger.addHandler(handler)
logger.setLevel(logging.DEBUG)
logging.basicConfig()
logger.info("==================== [App Initialized] ====================")

TIMEOUT = 10
INTERVAL = 10

SERVO_PIN = 12  # SG90-1
MIN_DEGREE = -90  # 000 : -90 degree
MAX_DEGREE = 90  # 180 : +90 degree

factory = PiGPIOFactory()
servo = AngularServo(
    SERVO_PIN,
    min_angle=MIN_DEGREE,
    max_angle=MAX_DEGREE,
    min_pulse_width=0.5 / 1000,
    max_pulse_width=2.4 / 1000,
    frame_width=1 / 50,
    pin_factory=factory,
)

DEVICE_NAME = os.environ["AWS_IOT_THING_NAME"]
ipc_client = awsiot.greengrasscoreipc.connect()
get_thing_shadow_request = GetThingShadowRequest()
get_thing_shadow_request.thing_name = DEVICE_NAME
get_thing_shadow_request.shadow_name = ""


def get_thing_shadow():
    """Get the thing shadow from AWS IoT Core"""
    try:
        op = ipc_client.new_get_thing_shadow()
        op.activate(get_thing_shadow_request)
        fut = op.get_response()
        result = fut.result(TIMEOUT)
        shadow_string = result.payload.decode("utf-8")
        shadow_dict = json.loads(shadow_string)
        return shadow_dict
    except Exception as e:
        logger.error(f"Error getting thing shadow: {e}", exc_info=True)
        return None


def control_servo(need_ventilation):
    """Control the servo based on the need for ventilation"""
    try:
        if need_ventilation:
            logger.info("Rotating servo 45 degrees to open the door.")
            servo.angle = 45
        else:
            logger.info("Rotating servo -45 degrees to close the door.")
            servo.angle = -45
    except Exception as e:
        logger.error(f"Error controlling servo: {e}", exc_info=True)


def main():
    try:
        while True:
            shadow_dict = get_thing_shadow()
            if shadow_dict:
                need_ventilation = shadow_dict["state"]["reported"]["ventilate"]
                logger.info(f"Do we need to ventilate? {need_ventilation}.")
                control_servo(need_ventilation)

            time.sleep(INTERVAL)

    except Exception as e:
        logger.error(f"Exception occurred: {e}", exc_info=True)

    finally:
        ipc_client.close()
        logger.info("==================== [App Stopped] ====================")


if __name__ == "__main__":
    main()
