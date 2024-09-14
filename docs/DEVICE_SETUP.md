# Configure IoT device

This document describes the initial setup of the IoT device (Raspberry Pi 4 Model B) and the necessary configurations to operate sensors and motors.

Please note that the contents described in this document are provided for referenc, and you should refer to the documentation of each device and implement them at your own risk.

1. [Configure Raspberry Pi OS](#1-configure-raspberry-pi)
2. [Configure sensors and motors](#2-configure-sensors-and-motors)
   - [Configure Temp, Humidity, Pressure sensor (BME280)](#configure-temp-humidity-pressure-sensor-bme280)
   - [Configure CO2 sensor (MH_Z19B)](#configure-co2-sensor-mh_z19b)
   - [Configure servo motor (SG90)](#configure-servo-motor-sg90)
3. [Configure AWS IoT Greengrass](#3-configure-aws-iot-greengrass)
4. [Deploy AWS IoT Greengrass Components](#4-deploy-aws-iot-greengrass-components)
5. [Validate deployment](#5-validate-deployment)

## 1. Configure Raspberry Pi OS

- See Setting up your [Raspberry Pi](https://projects.raspberrypi.org/en/projects/raspberry-pi-setting-up) to configure your device.
- In this sample, we [prepare the SD card](https://projects.raspberrypi.org/en/projects/raspberry-pi-setting-up/2) by writing Raspberry Pi OS (64 bit) operating system via the Raspberry Pi Imager.
- Connect to your Raspberry Pi by inserting SD card and configure initial setting such as user, WiFi and enable SSH.

## 2. Configure sensors and motors

Checkout pin layout of Raspberry Pi 4 Model B by `pingout` command.

```bash
$ pinout
Description        : Raspberry Pi 4B rev 1.5
... (省略)
J8:
   3V3  (1) (2)  5V
 GPIO2  (3) (4)  5V
 GPIO3  (5) (6)  GND
 GPIO4  (7) (8)  GPIO14
   GND  (9) (10) GPIO15
GPIO17 (11) (12) GPIO18
GPIO27 (13) (14) GND
GPIO22 (15) (16) GPIO23
   3V3 (17) (18) GPIO24
GPIO10 (19) (20) GND
 GPIO9 (21) (22) GPIO25
GPIO11 (23) (24) GPIO8
   GND (25) (26) GPIO7
 GPIO0 (27) (28) GPIO1
 GPIO5 (29) (30) GND
 GPIO6 (31) (32) GPIO12
GPIO13 (33) (34) GND
GPIO19 (35) (36) GPIO16
GPIO26 (37) (38) GPIO20
   GND (39) (40) GPIO21
... (省略)
```

### Configure Temp, Humidity, Pressure sensor (BME280)

1. Connect temperature, humidity and pressure sensor ([BME280](https://www.bosch-sensortec.com/products/environmental-sensors/humidity-sensors-bme280/)) to Raspberry Pi pins.

````
Sensor side	RaspberryPi 4 Model (number in brackets are pin layout number)
BME280 VCC	3.3V(1)
BME280 GND	GND(9)
BME280 SCL	GPIO3(5)
BME280 SDA	GPIO2(3)
BME280 CSB	-
BME280 SDD	GND(25)

2. Enable I2C on Raspberry Pi
* Run the command below after connecting with SSH.
```bash
sudo raspi-config
````

- Select `Interface Options`

![Alt text](/imgs/device_setup/raspi-config.png)

- Select `I4 I2C`
  ![Alt text](/imgs/device_setup/raspi-config-i2c-1.png)
- Select `Yes`
  ![Alt text](/imgs/device_setup/raspi-config-i2c-2.png)
- Click `Ok` and select `Finish`
  ![Alt text](/imgs/device_setup/raspi-config-i2c-3.png)
- Reboot after configuration

```bash
sudo reboot
```

- Install `i2c-tools` to validata sensor connectivity

```bash
sudo apt-get install i2c-tools
i2cdetect -y 1
```

- Connection is normal if `76` is displayed like below.

```
     0  1  2  3  4  5  6  7  8  9  a  b  c  d  e  f
00:                         -- -- -- -- -- -- -- --
10: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
20: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
30: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
40: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
50: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
60: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
70: -- -- -- -- -- -- 76 --
```

### Configure CO2 sensor (MH_Z19B)

1. Connect CO2 sensor ([MH-Z19](https://www.winsen-sensor.com/sensors/co2-sensor/mh-z19c.html)) to Raspberry Pi pins.

```
Sensor side	RaspberryPi 4 Model (number in brackets are pin layout)
MH-Z19 HD	-
MH-Z19 Tx	GPIO15(10)
MH-Z19 Rx	GPIO14(8)
MH-Z19 PWM	-
MH-Z19 GND	GND(14)
MH-Z19 VIN	5V(2)
```

2. Enable Serial on Raspberry Pi

- Run the command below after connecting with SSH.

```bash
sudo raspi-config
```

- Select `3 Interface Options`

![alt text](/imgs/device_setup/raspi-config.png)

- Select `I6 Serial Port`

![alt text](/imgs/device_setup/raspi-config-serial-1.png)

- Select `No`

![alt text](/imgs/device_setup/raspi-config-serial-2.png)

- Select `Yes`

![alt text](/imgs/device_setup/raspi-config-serial-4.png)

- Click `Ok` and select `Finish`
  ![alt text](/imgs/device_setup/raspi-config-serial-3.png)

- Reboot

```bash
sudo reboot
```

### Configure servo motor (SG90)

1. Connect servo motor ([SG90](https://www.towerpro.com.tw/product/sg90-7/))to Raspberry Pi pins.

```
Motor side	RaspberryPi 4 Model (number in brackets are pin layout)
SG90 Yellow	GPIO12(32)
SG90 Red	5V(4)
SG90 Brown	GND(6)
```

2. Run the command below to install packages and run service

```bash
sudo apt install pigpio
sudo service pigpiod start
sudo systemctl enable pigpiod.service
```

## 3. Configure AWS IoT Greengrass

Refer [AWS IoT Greengrass - Getting Started](https://docs.aws.amazon.com/greengrass/v2/developerguide/getting-started.html) to setup AWS IoT Greengrass on your device.

Following is a step to run on Raspberry Pi device.

1. Install AWS CLI

```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
aws --version
```

2. Install Java Development Kit.

```bash
sudo apt install default-jdk
java -version
```

3. Configure AWS IAM credentials and default region.

```bash
export AWS_ACCESS_KEY_ID=<insert your access key>
export AWS_SECRET_ACCESS_KEY=<insert secret access key>
export AWS_SESSION_TOKEN=<insert session token>
export AWS_REGION=<insert region>
```

4. Install Greengrass Core component.

```bash
cd ~
curl -s https://d2s8p88vqu9w66.cloudfront.net/releases/greengrass-nucleus-latest.zip > greengrass-nucleus-latest.zip
unzip greengrass-nucleus-latest.zip -d GreengrassInstaller && rm greengrass-nucleus-latest.zip
```

5. Run the command to register the Greengrass device. You can find the command for your device in the output `GreengrassStack.GreengrassBootstrapGreengrassInstallCommandforLinux~`t of `cdk deploy --all` command.

Here is an example of registering `SensingDevice1` device.

```bash
sudo -E java "-Droot=/greengrass/v2" "-Dlog.store=FILE"  -jar ./GreengrassInstaller/lib/Greengrass.jar --aws-region us-west-2  --thing-name SensingDevice1 --thing-policy-name SensingDevice1ThingPolicy --tes-role-name  GreengrassStack-SensingDevice1GreengrassTESRole5551-5P3cYy7LMKix --tes-role-alias-name GreengrassStack-SensingDevice1GreengrassTESRole5551-5P3cYy7LMKixAlias --component-default-user ggc_user:ggc_group --provision true --setup-system-service true --deploy-dev-tools true
```

![alt text](/imgs/device_setup/greengrass-setup.png)

6. Create AWS IoT Things device shadow.

```bash
aws iot-data update-thing-shadow \--cli-binary-format raw-in-base64-out \
--thing-name SensingDevice1 \
--payload '{"state":{"reported":{"ventilate":true}}}' \
"output.txt"
aws iot-data update-thing-shadow \
--cli-binary-format raw-in-base64-out \
--thing-name SensingDevice1 --shadow-name ventilation \
--payload '{"state":{"reported":{"ventilate":true}}}' \
"output.txt"
```

### 4. Deploy AWS IoT Greengrass Components

Refer [Deploy AWS IoT Greengrass components to devices](https://docs.aws.amazon.com/greengrass/v2/developerguide/manage-deployments.html) to deploy Greengrass components to your device.

1. Create copy of [gg-deployment-template.json](/docs/gg-deployment-template.json) as `docs/device-deployment-{thing-name}.json` and update parameters to adjust to your device and components.

- Replace {aws_region}, {aws_account}and {thing_name} with your AWS Region, Account and IoT Thing Name of your device.
- Replace {componentVersion} value with `GreengrassStack.~ComponentVersion` output of `cdk deploy --all` command.
- Run the command below to deploy Greengrass Component.

```bash
aws greengrassv2 create-deployment --cli-input-json file://docs/device-deployment-{thing-name}.json
```

## 5. Validate deployment

Check if there is no error log at your Greengrass device.

```bash
sudo tail -f /greengrass/v2/logs/greengrass.log
```

```bash
sudo tail -f /greengrass/v2/logs/collectSensorData.log
```

```bash
sudo tail -f /greengrass/v2/logs/automateVentilation.log
```
