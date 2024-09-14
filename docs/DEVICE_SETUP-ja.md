# IoTデバイスの設定

このドキュメントでは、IoTデバイス（Raspberry Pi 4 Model B）の初期セットアップと、センサーとモーターを動作させるために必要な設定について説明します。

なお、このドキュメントの内容は参考用であり、各デバイスのドキュメントを参照し、自己責任で実装してください。

1. [Raspberry Pi OSの設定](#1-raspberry-pi-osの設定)
2. [センサーとモーターの設定](#2-センサーとモーターの設定)
   - [温度・湿度・気圧センサー（BME280）の設定](#温度湿度気圧センサーbme280の設定)
   - [CO2センサー（MH_Z19B）の設定](#co2センサーmh_z19bの設定)
   - [サーボモーター（SG90）の設定](#サーボモーターsg90の設定)
3. [AWS IoT Greengrassの設定](#3-aws-iot-greengrassの設定)
4. [AWS IoT Greengrassコンポーネントのデプロイ](#4-aws-iot-greengrassコンポーネントのデプロイ)
5. [デプロイの検証](#5-デプロイの検証)

## 1. Raspberry Pi OSの設定

- [Raspberry Piのセットアップ](https://projects.raspberrypi.org/en/projects/raspberry-pi-setting-up)を参照してデバイスを設定してください。
- このサンプルでは、Raspberry Pi Imagerを使用して[SDカードを準備](https://projects.raspberrypi.org/en/projects/raspberry-pi-setting-up/2)し、Raspberry Pi OS（64ビット）オペレーティングシステムを書き込みます。
- SDカードを挿入してRaspberry Piに接続し、ユーザー、WiFi、SSHの有効化などの初期設定を行います。

## 2. センサーとモーターの設定

Raspberry Pi 4 Model Bのピンレイアウトを`pinout`コマンドで確認します。

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

### 温度・湿度・気圧センサー（BME280）の設定

1. 温度・湿度・気圧センサー（[BME280](https://www.bosch-sensortec.com/products/environmental-sensors/humidity-sensors-bme280/））をRaspberry Piのピンに接続します。

```
センサ側        Raspberry Pi 4 Model（括弧内はピンレイアウト番号）
BME280 VCC    3.3V(1)
BME280 GND    GND(9)
BME280 SCL    GPIO3(5)
BME280 SDA    GPIO2(3)
BME280 CSB    -
BME280 SDD    GND(25)
```

2. Raspberry PiのI2Cを有効にします

- SSHで接続後、以下のコマンドを実行します。

```bash
sudo raspi-config
```

- `Interface Options`を選択します

![Alt text](/imgs/device_setup/raspi-config.png)

- `I4 I2C`を選択します
  ![Alt text](/imgs/device_setup/raspi-config-i2c-1.png)
- `Yes`を選択します
  ![Alt text](/imgs/device_setup/raspi-config-i2c-2.png)
- `Ok`をクリックし、`Finish`を選択します
  ![Alt text](/imgs/device_setup/raspi-config-i2c-3.png)
- 設定後、再起動します

```bash
sudo reboot
```

- センサーの接続を確認するために`i2c-tools`をインストールします

```bash
sudo apt-get install i2c-tools
i2cdetect -y 1
```

- 以下のように`77`が表示されれば正常です。

```
     0  1  2  3  4  5  6  7  8  9  a  b  c  d  e  f
00:                         -- -- -- -- -- -- -- --
10: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
20: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
30: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
40: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
50: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
60: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
70: -- -- -- -- -- -- -- 76
```

### CO2センサー（MH_Z19B）の設定

1. CO2センサー（[MH-Z19](https://www.winsen-sensor.com/sensors/co2-sensor/mh-z19c.html)）をRaspberry Piのピンに接続します。

```
センサ側        Raspberry Pi 4 Model（括弧内はピンレイアウト）
MH-Z19 HD    -
MH-Z19 Tx    GPIO15(10)
MH-Z19 Rx    GPIO14(8)
MH-Z19 PWM   -
MH-Z19 GND   GND(14)
MH-Z19 VIN   5V(2)
```

2. Raspberry Piのシリアルポートを有効にします

- SSHで接続後、以下のコマンドを実行します。

```bash
sudo raspi-config
```

- `3 Interface Options`を選択します

![alt text](/imgs/device_setup/raspi-config.png)

- `I6 Serial Port`を選択します

![alt text](/imgs/device_setup/raspi-config-serial-1.png)

- `No`を選択します

![alt text](/imgs/device_setup/raspi-config-serial-2.png)

- `Yes`を選択します

![alt text](/imgs/device_setup/raspi-config-serial-4.png)

- `Ok`をクリックし、`Finish`を選択します
  ![alt text](/imgs/device_setup/raspi-config-serial-3.png)

- 再起動します

```bash
sudo reboot
```

### サーボモーター（SG90）の設定

1. サーボモーター（[SG90](https://www.towerpro.com.tw/product/sg90-7/））をRaspberry Piのピンに接続します。

```
モーター側      Raspberry Pi 4 Model（括弧内はピンレイアウト）
SG90 Yellow   GPIO12(32)
SG90 Red      5V(4)
SG90 Brown    GND(6)
```

2. 以下のコマンドを実行してパッケージをインストールし、サービスを実行します

```bash
sudo apt install pigpio
sudo service pigpiod start
sudo systemctl enable pigpiod.service
```

## 3. AWS IoT Greengrassの設定

デバイスにAWS IoT Greengrassをセットアップするには、[AWS IoT Greengrass - Getting Started](https://docs.aws.amazon.com/greengrass/v2/developerguide/getting-started.html)を参照してください。

以下は、Raspberry Piデバイスで実行する手順です。

1. AWS CLIをインストールします

```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
aws --version
```

2. Java Development Kitをインストールします。

```bash
sudo apt install default-jdk
java -version
```

3. AWS IAM認証情報と AWS リージョンを設定します。

```bash
export AWS_ACCESS_KEY_ID=<insert your access key>
export AWS_SECRET_ACCESS_KEY=<insert secret access key>
export AWS_SESSION_TOKEN=<insert session token>
export AWS_REGION=<insert region>
```

4. Greengrass Coreコンポーネントをインストールします。

```bash
cd ~
curl -s https://d2s8p88vqu9w66.cloudfront.net/releases/greengrass-nucleus-latest.zip > greengrass-nucleus-latest.zip
unzip greengrass-nucleus-latest.zip -d GreengrassInstaller && rm greengrass-nucleus-latest.zip
```

5. Greengrassデバイスを登録するコマンドを実行します。`cdk deploy --all`コマンドの出力`GreengrassStack.GreengrassBootstrapGreengrassInstallCommandforLinux~`にあるデバイス用のコマンドを見つけることができます。

以下は`SensingDevice1`デバイスを登録する例です。

```bash
sudo -E java "-Droot=/greengrass/v2" "-Dlog.store=FILE"  -jar ./GreengrassInstaller/lib/Greengrass.jar --aws-region us-west-2  --thing-name SensingDevice1 --thing-policy-name SensingDevice1ThingPolicy --tes-role-name  GreengrassStack-SensingDevice1GreengrassTESRole5551-5P3cYy7LMKix --tes-role-alias-name GreengrassStack-SensingDevice1GreengrassTESRole5551-5P3cYy7LMKixAlias --component-default-user ggc_user:ggc_group --provision true --setup-system-service true --deploy-dev-tools true
```

![alt text](/imgs/device_setup/greengrass-setup.png)

6. AWS IoT Thingsデバイスシャドウを作成します。

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

### 4. AWS IoT Greengrassコンポーネントのデプロイ

デバイスにGreengrassコンポーネントをデプロイするには、[デバイスへのAWS IoT Greengrassコンポーネントのデプロイ](https://docs.aws.amazon.com/greengrass/v2/developerguide/manage-deployments.html)を参照してください。

1. [gg-deployment-template.json](/docs/gg-deployment-template.json)のコピーを`docs/device-deployment-{thing-name}.json`として作成し、デバイスとコンポーネントに合わせてパラメータを更新します。

- {aws_region}、{aws_account}と{thing_name}をあなたのAWSリージョン、アカウントとデバイスのIoT Thing名に置き換えてください。
- {componentVersion}の値を`cdk deploy --all`コマンドの出力`GreengrassStack.~ComponentVersion`に置き換えてください。
- 以下のコマンドを実行してGreengrassコンポーネントをデプロイします。

```bash
aws greengrassv2 create-deployment --cli-input-json file://docs/device-deployment-{thing-name}.json
```

## 5. デプロイの検証

Greengrassデバイスでエラーログがないか確認します。

```bash
sudo tail -f /greengrass/v2/logs/greengrass.log
```

```bash
sudo tail -f /greengrass/v2/logs/collectSensorData.log
```

```bash
sudo tail -f /greengrass/v2/logs/automateVentilation.log
```
