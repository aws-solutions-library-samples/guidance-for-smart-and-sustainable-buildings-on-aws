# Smart and Sustainable Buildings on AWS

日本語は[こちら](/docs/README-ja.md)

## Table of Contents

1. [Overview](#overview-required)
   - [Architecture](#architecture)
   - [Cost](#cost)
   - [Folder Structure](#folder-structure)
2. [Prerequisites](#prerequisites-required)
   - [Operating System](#operating-system-required)
   - [Third-Party tools](#third-party-tools)
   - [AWS Account Requirements](#aws-account-requirements)
3. [Deployment Steps](#deployment-steps-required)
4. [Deployment Validation](#deployment-validation-required)
5. [Running the Guidance](#running-the-guidance-required)
6. [Next Steps](#next-steps-required)
7. [Cleanup](#cleanup-required)
8. [FAQ](#faq)
9. [Other references](#other-references)
10. [Notices](#notices-optional)
11. [Authors](#authors-optional)

## Overview

This is an example implementation of [Guidance for Smart and Sustainable Buildings on AWS](https://aws.amazon.com/solutions/guidance/smart-and-sustainable-buildings-on-aws/?did=sl_card&trk=sl_card) to demonstrate how to collect, visualize buildings data to gain insight and automate operation to optimize energy usage, cost and associated Greenhouse Gas (GHG) emissions.

This guidance uses the [AWS Cloud Development Kit (AWS CDK)](https://aws.amazon.com/cdk/) to deploy infrastructure assets and [AWS IoT Greengrass](https://aws.amazon.com/jp/greengrass/) to deploy component to edge devices.

### Architecture

![architecture](/imgs/architecture.png)

1. In this sample scenario, we have two buildings with heater and ventilation system. The aim is to keep the building at desired temperature and air quality while optimizing energy usage.
2. Install plug-in sensor to measure the energy used by the heater which stores data in external service which is accesible via API.
3. Install edge IoT device with [AWS IoT Greengrass](https://aws.amazon.com/jp/greengrass/) components. One component collects temperature and CO2 ppm sensor data and sends to [AWS IoT Core](https://aws.amazon.com/jp/iot-core/), and the other component ventilate building automatically by monitoring IoT Things Device Shadow to indicate the neccesity of ventilation due to CO2 ppm is high.
4. AWS IoT Core collects the sensor data which routes to [AWS Lambda](https://aws.amazon.com/lambda/?nc1=h_ls) then stores in [Amazon Timestream](https://aws.amazon.com/timestream/?nc1=h_ls) for real time data analytics.
5. [Amazon EventBridge](https://aws.amazon.com/jp/eventbridge/) triggers AWS Lambda at regular interval to collect data from external service, such as energy usage and weather data service.
6. [Amazon Managed Grafana](https://aws.amazon.com/jp/grafana/) connects to Amazon Timestream to visualize data in real-time.

![dashboard](/imgs/dashboard.png)

<!-- TODO Insert gif of demo that opens/close door based on device shadow -->

### Cost

You are responsible for the cost of AWS services used while running this Guidance sample code.

Note: Actual costs may vary based on factors such as the number of devices, Amazon Managed Grafana users, and frequency of Amazon Timestream queries

#### Example 1: 2 devices

As of August 2024, the estimated cost for running this solution in the US West 2 (Oregon) region with following assumption is approximately $117.43 per month.

##### Assumptions

This cost scenario is based on the following configuration:

- IoT Sensor Data ingestion from 2 IoT Greengrass Devices at 10-second intervals (518,400 requests/month)
- Energy usage API data collection at 1-minute intervals (43,200 requests/month)
- Weather data collection at 5-minute intervals (10,800 requests/month)

##### Cost Breakdown by Service

| AWS service                               | Dimensions                                                                                                                  | Monthly Cost [USD] |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| AWS IoT Greengrass                        | 2 Active Devices                                                                                                            | $0.33              |
| AWS IoT Core                              | 86,400 connection minutes, 518,400 Messages, 518,400 Device Shadow operations,518,400 Rule Engine actions                   | $1.42              |
| AWS Lambda (IoT Sensor Data Collection)   | 518,400 requests, 128 MB memory allocation, 200 msec duration                                                               | $0.32              |
| AWS Lambda (Device Shadow)                | 518,400 requests, 128 MB memory allocation, 1s duration                                                                     | $1.18              |
| AWS Lambda (Energy Usage Data Collection) | 43,200 requests, 128 MB memory allocation, 200 ms duration                                                                  | $0.19              |
| AWS Lambda (Weather Data Collection)      | 10,800 requests, 128 MB memory allocation, 1s duration                                                                      | $0.02              |
| Amazon Timestream                         | 1KB record size, 0.62 GB memory store writes, 4 TCU x 40 hours, 3 days memory retention, 3 month magnetic storage retention | $84.77             |
| Amazon Managed Grafana                    | 2 active editors, 2 active viewers                                                                                          | $28                |
| Amazon DynamoDB                           | 1 million read requests units                                                                                               | $0.13              |
| AWS Secrets Manager                       | 2 secrets, 54,000 API calls                                                                                                 | $1.07              |
| **Total Estimated Monthly Cost**          |                                                                                                                             | **$117.43**        |

#### Example 2: 1,000 devices

As of August 2024, the estimated cost for running this solution in the US West 2 (Oregon) region is approximately $4,671.12 per month.

##### Assumptions

This cost scenario is based on the following configuration:

- IoT Sensor Data ingestion from 1,000 IoT Greengrass Devices at 10-second intervals (259,200,000 requests/month)
- Energy usage API data collection at 1-minute intervals (43,200 requests/month)
- Weather data collection at 5-minute intervals (10,800 requests/month)
- 10 devices are installed per building. Each building has 1 Amazon Managed Grafana viewer.
- Amazon Timestream queries are made 8 hours/day for 30 days/month with average of 4 TCU.

##### Cost Breakdown by Service

| AWS service                               | Dimensions                                                                                                                     | Monthly Cost [USD] |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| AWS IoT Greengrass                        | 1,000 Active Devices                                                                                                           | $163.60            |
| AWS IoT Core                              | 43,200,000 connection minutes, 259,200,000 Messages, 259,200,000 Device Shadow operations, 259,200,000 Rule Engine actions     | $703.34            |
| AWS Lambda (IoT Sensor Data Collection)   | 259,200,000 requests, 128 MB memory allocation, 200 msec duration                                                              | $159.84            |
| AWS Lambda (Device Shadow)                | 259,200,000 requests, 128 MB memory allocation, 1s duration                                                                    | $591.84            |
| AWS Lambda (Energy Usage Data Collection) | 43,200 requests, 128 MB memory allocation, 100s duration                                                                       | $9.01              |
| AWS Lambda (Weather Data Collection)      | 10,800 requests, 128 MB memory allocation, 100s duration                                                                       | $2.25              |
| Amazon Timestream                         | 1KB record size, 310.80 GB memory store writes, 4 TCU x 730 hours, 3 days memory retention, 3 month magnetic storage retention | $2,459.67          |
| Amazon Managed Grafana                    | 2 active editors, 100 active viewers                                                                                           | $518.00            |
| Amazon DynamoDB                           | 500 million read requests units                                                                                                | $62.5              |
| AWS Secrets Manager                       | 2 secrets, 54,000 API calls                                                                                                    | $1.07              |
| **Total Estimated Monthly Cost**          |                                                                                                                                | **$4,671.12**      |

### Folder structure

```bash
smart-and-sustainable-buildings/
├── bin
│   └── smart-and-sustainable-buildings-demo.ts (CDK Main App)
├── docs (Documentation)
│   ├── README-ja.md (Japanese README)
│   └── DEVICE_SETUP.md (How to set up device)
├── imgs (Images such as screenshots)
├── lib
│   ├── construct (CDK Constructs)
│   │   ├── gdk-publish (Greengrass Development Kit related consutructs)
│   │   ├── datastore.ts (Timestream)
│   │   ├── greengrass-bootstrap.ts (Bootstrapping Greengrass)
│   │   ├── iot.ts (AWS IoT Core Rule and related Lambda)
│   │   ├── power-data-collection.ts (Collecting energy usage)
│   │   └── weather-data-collection.ts (Collecting weather data)
│   ├── gg_components (AWS IoT Greengrass Components)
│   │   ├── automate-ventilation (Component to automatically ventilate)
│   │   └── sensor-data-collection (Component to collect sensor data)
│   ├── grafana (Grafana Dashboard)
│   │   └── dashboard.json (Grafana Dashboard Template)
│   ├── lambda (Lambda functions assets)
│   │   ├── external-data-collection (Lambda functions to collect data from external service)
│   │   ├── gdk-publish (Lambda for publishing Greengrass Development Kit)
│   │   ├── iot (Lambda to handle IoT data)
│   │   └── layer (Lambda Layer)
│   ├── data-collection.ts (Stack for deploying backend resources)
│   └── greengrass-stack.ts (Stack for publishing AWS IoT Greengrass Component)
├── test (Test: not implemented)
├── tools
│   ├── dynamodb (Script to register device info to DynamoDB)
│   ├── lambda (Script to install Lamdba Layer packages)
│   └── secrets-manager (Script to register secrets to Secret Manager)
├── .gitignore
├── .npmignore
├── LICENSE
├── README.md (This document)
├── cdk.json (CDK configuration)
├── jest.config.js (Test configuration)
├── package-lock.json (Related package info)
├── package.json (elated package inf)
└── tsconfig.json (TypeScript configuration)
```

## Prerequisite

#### Operating System

These deployment instructions are intended for use on MacOS. Deployment using a different operating system may require additional steps.

### Third-Party tools

This project utilizes external APIs (such as OpenWeatherMap, SwitchBot, etc.) and hardware devides. When using these services, please adhere to their respective terms of service. This project is not responsible for any issues arising from the use of these external services.

#### Software

The following packages will need to be installed on your environment to deploy and run sample code provided in this guidance:

- An IDE of your choice
- [Latest version of Python](https://www.python.org/downloads/)
- [Node.js](https://nodejs.org/en/learn/getting-started/introduction-to-nodejs) and [TypeScript](https://www.npmjs.com/package/typescript) to deploy infrastructure with AWS CDK
- [OpenWeather Map API Key](https://openweathermap.org/appid)

#### Hardware

You need following hardware or equivalent alternative to run enjoy the full asset in this repository.
If you want to use different option, additional or modification of steps may be required.

- IoT device of your choice ([Raspberry Pi 4 Model B](https://www.raspberrypi.com/products/raspberry-pi-4-model-b/))
- Temperature sensor ([BME280](https://www.bosch-sensortec.com/products/environmental-sensors/humidity-sensors-bme280/))
- CO2 sensor ([MH-Z19](https://www.winsen-sensor.com/sensors/co2-sensor/mh-z19c.html))
- Servo motor ([SG90](https://www.towerpro.com.tw/product/sg90-7/))
- Plug-in sensor ([SwitchBot Plug Mini](https://www.switchbot.jp/products/switchbot-plug-mini) and [API Keys](https://blog.switchbot.jp/announcement/api-v1-1/))

### AWS Account Requirements

IAM users must have permissions to deploy the stack using AWS CDK. Refer to this documentation on how to assign [AWS Cloudformation permissions](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-permissions-cloudformation.html) to learn which actions need to be granted for deploying infrastructure.

Users will also need permission to deploy the following resources used in this guidance:

**Example Resources**:

- Amazon DynamoDB
- Amazon S3
- AWS Lambda
- AWS IoT
- Amazon Timestream
- AWS Secrets Manager
- AWS CodeBuild
- Amazon SNS
- AWS IAM
- AWS IAM Identity Center
- Access to a Region that supports this deployment [Default: US West 2 (Oregon)]
- Amazon Managed Grafana

### AWS CDK Bootstrap

This section provides the steps required to configure your environment before deploying the infrastructure using AWS CDK. These steps include:

1. Cloning the repository for this guidance
2. Installing node dependencies
3. Configure AWS IAM credentials
4. Bootstrap CDK

**1. Cloning the repository for this guidance**

<!-- TODO Replace with GitHub Repo -->

```bash
git clone https://github.com/aws-solutions-library-samples/guidance-for-smart-and-sustainable-buildings-on-aws-demo.git
```

**2. Installing node dependencies**

```bash
npm ci
```

**3. Configure AWS IAM credentials with specific permission**
If this is your first time setting up AWS IAM credentials for using AWS CDK, refer [Getting started with the AWS CDK](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html) to learn more.

```bash
export AWS_ACCESS_KEY_ID=<insert your access key>
export AWS_SECRET_ACCESS_KEY=<insert secret access key>
export AWS_SESSION_TOKEN=<insert session token>
```

**4. Set AWS Region to deploy resources**

- Set your AWS Region to deploy resources by command below. Below example sets AWS Region to Oregon (us-west-2)

```bash
export AWS_REGION=us-west-2
```

- Modify `{aws_region}` in `gdk-config.json` files under [GDK Config](/lib/gg_components/) for each component ([automate ventilation component](lib/gg_components/automate-ventilation/gdk-config.json) and [sensor data collection component](lib/gg_components/sensor-data-collection/gdk-config.json))

```json
...
      "publish": {
        "bucket": "gdk-components",
        "region": "{aws_region}"
      }
...
```

**5. Bootstrap CDK**

```bash
cdk bootstrap
```

## Deployment Steps

There are 6 steps to deploy the sample code for the guidance:

[1. Install Python dependencies for the Lambda layers](#1-install-python-dependencies-for-the-lambda-layers)
[2. Deploy the infrastructure with AWS CDK](#2-deploy-the-infrastructure-with-aws-cdk)
[3. Register device information into DynamoDB](#3-register-device-information-into-dynamodb)
[4. Register secrets into AWS Secret Manager](#4-register-secrets-into-aws-secret-manager)
[5. Configure device](#5-configure-device)
[6. Setup Amazon Managed Grafana Dashboard](#6-setup-amazon-managed-grafana-dashboard)

### 1. Install Python dependencies for the Lambda Layers

```bash
pip install -t lib/lambda/layer/open-weather-map/python -r lib/lambda/layer/open-weather-map/requirements.txt
pip install -t lib/lambda/layer/requests/python -r lib/lambda/layer/requests/requirements.txt
```

### 2. Deploy the infrastructure with AWS CDK

Run the commands below at the root directory of the repository.

```bash
npm ci
```

If this is your first time using the CDK in your AWS account, you need to [Bootstrap](https://docs.aws.amazon.com/ja_jp/cdk/v2/guide/bootstrapping.html) once. You don't need to run the command below if your account is already CDK bootstrapped.

```bash
cdk bootstrap
```

Next run command below to deploy AWS resources. It may take a while.

```bash
cdk deploy --all
```

Note the output of the command for resource ID which you will need to subsequent steps.
Example output are following.

```
 ✅  SustainableBuilding

✨  Deployment time: 53.85s

SustainableBuilding.DatastorelocationTable0A158CD4 = SustainableBuilding-DatastorelocationB25ECCC2-1F13H7MQ5JGUT
SustainableBuilding.PowerDataCollectionswitchBotApiSecretName96638740 = PowerDataCollectionswitchBo-p8emQ8cnT8SV
SustainableBuilding.WeatherDataCollectionOpenWeatherMapApiSecretNameCC86E358 = WeatherDataCollectionOpenWe-c1gS1OBWCXo8
...
 ✅  GreengrassStack

✨  Deployment time: 87.13s

Outputs:
GreengrassStack.AutomateVentilationComponentName = automateVentilation
GreengrassStack.AutomateVentilationComponentVersion = 1.0.0
GreengrassStack.SensingDevice1GreengrassInstallCommandforLinuxCD1E1E30 = sudo -E java "-Droot=/greengrass/v2" "-Dlog.store=FILE"  -jar ./GreengrassInstaller/lib/Greengrass.jar --aws-region us-west-2  --thing-name SensingDevice1 --thing-policy-name SensingDevice1ThingPolicy --tes-role-name  GreengrassStack-SensingDevice1GreengrassTESRole5551-5P3cYy7LMKix --tes-role-alias-name GreengrassStack-SensingDevice1GreengrassTESRole5551-5P3cYy7LMKixAlias --component-default-user ggc_user:ggc_group --provision true --setup-system-service true --deploy-dev-tools true
GreengrassStack.SensingDevice2GreengrassInstallCommandforLinuxB03CE7B0 = sudo -E java "-Droot=/greengrass/v2" "-Dlog.store=FILE"  -jar ./GreengrassInstaller/lib/Greengrass.jar --aws-region us-west-2  --thing-name SensingDevice2 --thing-policy-name SensingDevice2ThingPolicy --tes-role-name  GreengrassStack-SensingDevice2GreengrassTESRole9F2A-fvugXegtX4Bx --tes-role-alias-name GreengrassStack-SensingDevice2GreengrassTESRole9F2A-fvugXegtX4BxAlias --component-default-user ggc_user:ggc_group --provision true --setup-system-service true --deploy-dev-tools true
GreengrassStack.sensorDataCollectionComponentName = collectSensorData
GreengrassStack.sensorDataCollectionComponentVersion = 1.0.0
```

### 3. Register device information into DynamoDB

Run the command below after followings changes.

- Replace `{locationTable}` with the output value of `SustainableBuilding.DatastorelocationTable~` after running `cdk deploy --all`.
- Modify [tools/dynamodb/locations_1.json](tools/dynamodb/locations_1.json) and [tools/dynamodb/locations_2.json](tools/dynamodb/locations_2.json) according your location and devices (SwitchBot Plug Mini and Edge Device) info.

```bash
bash tools/dynamodb/add_location.sh {locationTable}
```

### 4. Register secrets into AWS Secret Manager

Run the command below after followings changes.

- Replace {secretid} with the output value of `ustainableBuilding.WeatherDataCollectionOpenWeatherMapApiSecretName~` after running `cdk deploy --all`.
- Replace {apikey} with the [OpenWeather Map API Key](https://openweathermap.org/appid) obtained at [Prerequisite - Hardware](#software).

```bash
bash tools/secrets-manager/register-openweathermap-secret.sh {secretid} {apikey}
```

### 5. Configure device

Set up AWS IoT Greengrass device by referencing [DEVICE_SETUP](/docs/DEVICE_SETUP.md).

### 6. Setup Amazon Managed Grafana Dashboard

If you follow previous steps, you will have data coming into Amazon Timestream.
Let's build a Amazon Managed Grafana dashboard to visualize near realtime data stored in the Amazon Timestream database.

Refer [Learn how to create and use Amazon Managed Grafana resources](https://docs.aws.amazon.com/grafana/latest/userguide/getting-started-with-AMG.html) for how to setup Amazon Managed Grafana resources.

Following is an example steps for setting up the resources and create sample dashboard.
Run these steps after logging in [AWS Management Console](https://aws.amazon.com/jp/console/).

1. Login AWS Management Console and select region which you deploy CDK resources.
2. Setup [IAM Identity Center](https://docs.aws.amazon.com/console/singlesignon/firstrun/getting-started) for managing users that can access to Amazon Managed Grafana.
3. Add user to IAM Identity Center.
4. Create [Amazon Managed Grafana Workspace](https://docs.aws.amazon.com/grafana/latest/userguide/Amazon-Managed-Grafana-setting-up.html). Following is the example configuration screenshots.
   ![Alt text](/imgs/grafana_dashboard/image.png)
   ![Alt text](/imgs/grafana_dashboard/image-1.png)
   ![Alt text](/imgs/grafana_dashboard/image-2.png)

5. Configure Amazon Timestream as data sources.

![Alt text](/imgs/grafana_dashboard/image-3.png)
![Alt text](/imgs/grafana_dashboard/image-4.png)

4. Add IAM Identity Center user on workspace with appropriate role (Admin, Viewer)

![Alt text](/imgs/grafana_dashboard/image-5.png)
![Alt text](/imgs/grafana_dashboard/image-6.png)

5. Access to Workspace URL to login with the IAM Identity Center user.

6. Configure Amazon Managed Grafana to set Amazon Timestream DB as data source.
   ![Alt text](/imgs/grafana_dashboard/image-7.png)
   ![Alt text](/imgs/grafana_dashboard/image-8.png)

7. [Import JSON File](https://docs.aws.amazon.com/grafana/latest/userguide/dashboard-export-and-import.html) to create dashboard from the template ([EN](/lib/grafana/dashboard.json), [JP](/lib/grafana/dashboard-jp.json)).

   ![Alt text](/imgs/grafana_dashboard/image-9.png)

![Alt test](/imgs/dashboard.png)

## Deployment Validation

### Deployment Validation - IoT Data Collection

- Check all the metrics such are energy usage, CO2 ppm, temperature and weather data are displayed in Amazon Managed Grafana dashboard like the screenshot below.

![Alt test](/imgs/dashboard.png)

### Deployment Validation - IoT Device Shadow

- Check if the [IoT Things Device Shadow](https://docs.aws.amazon.com/ja_jp/iot/latest/developerguide/iot-device-shadows.html) is updated when CO2 ppm is above the threshold (default 800 ppm) and ventilate the building door by rotating servo.

## Running the Guidance

Everything should run automatically after deployment completes. You can now monitor Amazon Managed Grafana dashboard and test how smart and sustainable buildings on AWS solution can optimize energy, cost and associated GHG emission by optimizing operation.

## Next Steps

This example implementation of the guidance provides a base for collecting, visualizing and automate operation to gain insights to optimize energy usage from multiple buildings. You can modify this sample to be tailered to your environment. This may include the following:

- Customize and increase edge devices and components to collect from other sources such as Building Management System, smart meter etc.
- Use Amazon Athena and Amazon QuickSight to perform historical data analysis and create reportings.
- Create digital twin with AWS IoT TwinMaker to visualize and monitor physical asset status.

## Cleanup

To cleanup, delete the following stacks in this order:

1. Amazon Managed Grafana resources.
2. AWS IAM Identity Center
3. CDK Resources
   To delete the resources created by AWS CDK, run the following command to delete stacks.

```bash
cdk destroy --all
```

## FAQ

## Notices

_Customers are responsible for making their own independent assessment of the information in this Guidance. This Guidance: (a) is for informational purposes only, (b) represents AWS current product offerings and practices, which are subject to change without notice, and (c) does not create any commitments or assurances from AWS and its affiliates, suppliers or licensors. AWS products or services are provided “as is” without warranties, representations, or conditions of any kind, whether express or implied. AWS responsibilities and liabilities to its customers are controlled by AWS agreements, and this Guidance is not part of, nor does it modify, any agreement between AWS and its customers._

## Other references

- Blog post: [サステナビリティを意識したミニチュア倉庫のデモを作ってみた !](https://aws.amazon.com/jp/builders-flash/202310/sustainability-factory-demo/)

## Authors
