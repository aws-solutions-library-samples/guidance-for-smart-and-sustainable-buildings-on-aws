# AWS上のスマートでより持続可能な建物

英語版は[こちら](/README.md)

## 目次

1. [概要](#概要)
   - [アーキテクチャ](#アーキテクチャ)
   - [コスト](#コスト)
   - [フォルダ構造](#フォルダ構造)
2. [前提条件](#前提条件)
   - [オペレーティングシステム](#オペレーティングシステム)
   - [サードパーティツール](#サードパーティツール)
   - [AWSアカウントの要件](#awsアカウントの要件)
3. [デプロイ手順](#デプロイ手順)
4. [デプロイの検証](#デプロイの検証)
5. [ガイダンスの実行](#ガイダンスの実行)
6. [次のステップ](#次のステップ)
7. [クリーンアップ](#クリーンアップ)
8. [FAQ](#faq)
9. [その他の参考資料](#その他の参考資料)
10. [注意事項](#注意事項)
11. [著者](#著者)

## 概要

これは[ソリューションガイダンス](https://aws.amazon.com/solutions/guidance/smart-and-sustainable-buildings-on-aws/?did=sl_card&trk=sl_card)の実装例で、建物データを収集・可視化し、エネルギー使用量、コスト、関連する温室効果ガス（GHG）排出量を最適化するための洞察を得て運用を自動化する方法を示しています。

このガイダンスでは、インフラストラクチャ資産のデプロイに[AWS Cloud Development Kit (AWS CDK)](https://aws.amazon.com/cdk/)を使用し、エッジデバイスにコンポーネントをデプロイするために[AWS IoT Greengrass](https://aws.amazon.com/jp/greengrass/)を使用しています。

### アーキテクチャ

![アーキテクチャ](/imgs/architecture.png)

1. このサンプルシナリオでは、暖房と換気システムを備えた2つの建物があります。目的は、エネルギー使用を最適化しながら、建物を望ましい温度と空気品質に保つことです。
2. 暖房器具のエネルギー使用量を測定するプラグインセンサーを設置し、APIを介してアクセス可能な外部サービスにデータを保存します。
3. [AWS IoT Greengrass](https://aws.amazon.com/jp/greengrass/)コンポーネントを搭載したエッジIoTデバイスを設置します。1つのコンポーネントは温度とCO2 ppmセンサーデータを収集し[AWS IoT Core](https://aws.amazon.com/jp/iot-core/) に送信し、もう1つのコンポーネントはCO2 ppmが高いためにIoT Thingsデバイスシャドウをモニタリングして換気の必要性を示す場合に自動的に建物を換気します。
4. AWS IoT Coreはセンサーデータを収集し、[AWS Lambda](https://aws.amazon.com/lambda/?nc1=h_ls)にルーティングしてから、リアルタイムデータ分析のために[Amazon Timestream](https://aws.amazon.com/timestream/?nc1=h_ls)に保存します。
5. [Amazon EventBridge](https://aws.amazon.com/jp/eventbridge/)は定期的にAWS Lambdaをトリガーして、エネルギー使用量や気象データサービスなどの外部サービスからデータを収集します。
6. [Amazon Managed Grafana](https://aws.amazon.com/jp/grafana/)はAmazon Timestreamに接続してリアルタイムでデータを可視化します。

![ダッシュボード](/imgs/dashboard.png)

### コスト

このガイダンスのサンプルコードを実行する際のAWSサービスの費用はお客様の負担となります。

注意: 実際のコストは、デバイス数、Amazon Managed Grafanaのユーザー数、Amazon Timestreamのクエリ頻度などによって異なる場合があります。

#### 例 1: 2台のデバイス

2024年8月時点で、us-west-2 (オレゴン) リージョンで以下の前提条件においてこのソリューションを実行する場合の推定コストは、月額約$122.43 (USD)です。

##### 前提条件

このコストシナリオは、以下の構成に基づいています：

- 2台のIoT Greengrassデバイスから10秒間隔でIoTセンサーデータを取り込む（月518,400リクエスト）
- 1分間隔でエネルギー使用量APIデータを収集（月43,200リクエスト）
- 5分間隔で気象データを収集（月10,800リクエスト）

##### サービスごとのコスト内訳

| AWS サービス                    | 構成                                                                                                         | 月額コスト [USD] |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------- |
| AWS IoT Greengrass              | 2台のアクティブデバイス                                                                                      | $0.33            |
| AWS IoT Core                    | 86,400接続分、518,400メッセージ、518,400デバイスシャドウ操作、518,400ルールエンジンアクション                | $1.42            |
| AWS Lambda (IoT データ収集)     | 518,400リクエスト、128 MBメモリ、200 ms実行時間                                                              | $0.32            |
| AWS Lambda (デバイスシャドウ)   | 518,400リクエスト、128 MBメモリ、1s実行時間                                                                  | $1.18            |
| AWS Lambda (電力消費データ収集) | 43,200リクエスト、128 MBメモリ、200 ms実行時間                                                               | $0.19            |
| AWS Lambda (天気データ収集)     | 10,800リクエスト、128 MBメモリ、1s実行時間                                                                   | $0.02            |
| Amazon Timestream               | 1KBレコードサイズ、0.62 GBメモリストア書き込み、4 TCU x 40時間、3日間のメモリ保持、3ヶ月の磁気ストレージ保持 | $84.77           |
| Amazon Managed Grafana          | 2 エディタ、2 ビューワー                                                                                     | $28              |
| Amazon DynamoDB                 | 100万読取リクエスト                                                                                          | $0.13            |
| AWS Secrets Manager             | 2 シークレット, 54,000 APIコール                                                                             | $1.07            |
| **合計月額コスト試算**          |                                                                                                              | **$117.43**      |

#### 例 2: 1,000 台のデバイス

2024年8月時点で、us-west-2 (オレゴン) リージョンで以下の前提条件においてこのソリューションを実行する場合の推定コストは、月額約$4,671.12 (USD)です。

##### 前提条件

このコストシナリオは、以下の構成に基づいています：

- 1,000 台のIoT Greengrassデバイスから10秒間隔でIoTセンサーデータを取り込む（月259,200,000リクエスト）
- 1分間隔でエネルギー使用量APIデータを収集（月43,200リクエスト）
- 5分間隔で気象データを収集（月10,800リクエスト）
- 1つの建物あたり10台のデバイスが設置され、各建物には1 Amazon Managed Grafanaビューワーを割り当て
- Amazon Timestreamへのクエリは、1日8時間、月30日間、平均4 TCU（Timestream Capacity Unit）で実行

##### サービスごとのコスト内訳

| AWS サービス                    | 構成                                                                                                            | 月額コスト [USD] |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------- |
| AWS IoT Greengrass              | 1,000 台のアクティブデバイス                                                                                    | $163.60          |
| AWS IoT Core                    | 43,200,000接続分、259,200,000メッセージ、259,200,000デバイスシャドウ操作、259,200,000ルールエンジンアクション   | $703.34          |
| AWS Lambda (IoT データ収集)     | 259,200,000リクエスト、128 MBメモリ、200 ms実行時間                                                             | $159.84          |
| AWS Lambda (デバイスシャドウ)   | 259,200,000リクエスト、128 MBメモリ、1s実行時間                                                                 | $591.84          |
| AWS Lambda (電力消費データ収集) | 43,200リクエスト、128 MBメモリ、100s実行時間                                                                    | $9.01            |
| AWS Lambda (天気データ収集)     | 10,800リクエスト、128 MBメモリ、100s実行時間                                                                    | $2.25            |
| Amazon Timestream               | 1KBレコードサイズ、310.80 GBメモリストア書き込み、4 TCU x 730時間、3日間のメモリ保持、3ヶ月の磁気ストレージ保持 | $2,459.67        |
| Amazon Managed Grafana          | 2 エディタ、100 ビューワー                                                                                      | $518.00          |
| Amazon DynamoDB                 | 100万読取リクエスト                                                                                             | $62.5            |
| AWS Secrets Manager             | 2 シークレット, 54,000 APIコール                                                                                | $1.07            |
| **合計月額コスト試算**          |                                                                                                                 | **$4,671.12**    |

### フォルダ構造

```bash
smart-and-sustainable-buildings/
├── bin
│   └── smart-and-sustainable-buildings-demo.ts (CDKメインアプリ)
├── docs (ドキュメント)
│   ├── README-ja.md (日本語README)
│   └── DEVICE_SETUP.md (デバイスのセットアップ方法)
├── imgs (スクリーンショットなどの画像)
├── lib
│   ├── construct (CDKコンストラクト)
│   │   ├── gdk-publish (Greengrass Development Kit関連コンストラクト)
│   │   ├── datastore.ts (Timestream)
│   │   ├── greengrass-bootstrap.ts (Greengrassのブートストラップ)
│   │   ├── iot.ts (AWS IoT CoreルールとAWS Lambda)
│   │   ├── power-data-collection.ts (エネルギー使用量の収集)
│   │   └── weather-data-collection.ts (気象データの収集)
│   ├── gg_components (AWS IoT Greengrassコンポーネント)
│   │   ├── automate-ventilation (自動換気コンポーネント)
│   │   └── sensor-data-collection (センサーデータ収集コンポーネント)
│   ├── grafana (Grafanaダッシュボード)
│   │   └── dashboard.json (Grafanaダッシュボードテンプレート)
│   ├── lambda (Lambda関数アセット)
│   │   ├── external-data-collection (外部サービスからデータを収集するAWS Lambda関数)
│   │   ├── gdk-publish (Greengrass Development Kitを公開するAWS Lambda)
│   │   ├── iot (IoTデータを処理するAWS Lambda)
│   │   └── layer (AWS Lambdaレイヤー)
│   ├── data-collection.ts (バックエンドリソースをデプロイするスタック)
│   └── greengrass-stack.ts (AWS IoT Greengrassコンポーネントを公開するスタック)
├── tools
│   ├── dynamodb (デバイス情報を Amazon DynamoDBに登録するスクリプト)
│   └── secrets-manager (シークレットを Secrets Managerに登録するスクリプト)
├── .gitignore
├── .npmignore
├── LICENSE
├── README.md (このドキュメント)
├── cdk.json (CDK設定)
├── jest.config.js (テスト設定)
├── package-lock.json (関連パッケージ情報)
├── package.json (関連パッケージ情報)
└── tsconfig.json (TypeScript設定)
```

## 前提条件

#### オペレーティングシステム

これらのデプロイ手順はMacOSでの使用を想定しています。異なるオペレーティングシステムを使用してデプロイする場合は、追加の手順が必要になる場合があります。

### サードパーティツール

このプロジェクトは外部API（OpenWeatherMap、SwitchBotなど）や他社が提供する製品を利用しています。これらのサービスを使用する際は、各サービスの利用規約に従ってください。本プロジェクトは、これらの外部サービスの使用に起因するいかなる問題についても責任を負いません。

#### ソフトウェア

このガイダンスで提供されているサンプルコードをデプロイして実行するには、以下のパッケージを環境にインストールする必要があります：

- お好みのIDE
- [最新バージョンのPython](https://www.python.org/downloads/)
- AWS CDKでインフラストラクチャをデプロイするための[Node.js](https://nodejs.org/en/learn/getting-started/introduction-to-nodejs)と[TypeScript](https://www.npmjs.com/package/typescript)
- [OpenWeather Map APIキー](https://openweathermap.org/appid)

#### ハードウェア

このリポジトリの全アセットを楽しむには、以下のハードウェアまたは同等の代替品が必要です。
異なるオプションを使用する場合は、追加または手順の変更が必要になる場合があります。

- お好みのIoTデバイス（[Raspberry Pi 4 Model B](https://www.raspberrypi.com/products/raspberry-pi-4-model-b/)）
- 温度センサー（[BME280](https://www.bosch-sensortec.com/products/environmental-sensors/humidity-sensors-bme280/))
- CO2センサー（[MH-Z19](https://www.winsen-sensor.com/sensors/co2-sensor/mh-z19c.html))
- サーボモーター（[SG90](https://www.towerpro.com.tw/product/sg90-7/))
- プラグインセンサー（[SwitchBot Plug Mini](https://www.switchbot.jp/products/switchbot-plug-mini)と[APIキー](https://blog.switchbot.jp/announcement/api-v1-1/))

### AWSアカウントの要件

IAMユーザーは、AWS CDKを使用してスタックをデプロイするための権限が必要です。インフラストラクチャをデプロイするために付与する必要があるアクションについては、[AWS Cloudformation権限](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-permissions-cloudformation.html)のドキュメントを参照してください。

ユーザーは、このガイダンスで使用される以下のリソースをデプロイするための権限も必要です：

**例示リソース**：

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
- このデプロイをサポートするリージョンへのアクセス [デフォルト：US West 2（オレゴン）]
- Amazon Managed Grafana

### AWS CDKブートストラップ

このセクションでは、AWS CDKを使用してインフラストラクチャをデプロイする前に環境を設定するために必要な手順を提供します。これらの手順には以下が含まれます：

1. このガイダンスのリポジトリをクローンする
2. ノード依存関係をインストールする
3. AWS IAM認証情報を設定する
4. CDKをブートストラップする

**1. このガイダンスのリポジトリをクローンする**


```bash
git clone https://github.com/aws-solutions-library-samples/guidance-for-smart-and-sustainable-buildings-on-aws.git
```

**2. ノード依存関係をインストールする**

```bash
npm ci
```

**3. 特定の権限を持つAWS IAM認証情報を設定する**
AWS CDKを使用するためのAWS IAM認証情報を初めて設定する場合は、[AWS CDKの使用開始](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html)を参照して詳細を確認してください。

```bash
export AWS_ACCESS_KEY_ID=<insert your access key>
export AWS_SECRET_ACCESS_KEY=<insert secret access key>
export AWS_SESSION_TOKEN=<insert session token>
```

**4. リソースをデプロイするAWSリージョンを設定する**

- 以下のコマンドを使用して、リソースをデプロイするAWSリージョンを設定します。以下の例では、AWSリージョンをオレゴン（us-west-2）に設定しています。

```bash
export AWS_REGION=us-west-2
```

- [GDK Config](/lib/gg_components/)配下の各コンポーネント（[自動換気コンポーネント](lib/gg_components/automate-ventilation/gdk-config.json)と[センサーデータ収集コンポーネント](lib/gg_components/sensor-data-collection/gdk-config.json)）の`gdk-config.json`ファイル内の`{aws_region}`を変更します。

```json
...
      "publish": {
        "bucket": "gdk-components",
        "region": "us-west-2"
      }
...
```

**5. CDKをブートストラップする**

```bash
cdk bootstrap
```

## デプロイ手順

このガイダンスのサンプルコードをデプロイするには6つの手順があります：

[1. AWS Lambda レイヤーPython依存関係をインストールする](#1-aws-lambda-レイヤーのpython依存関係をインストールする)
[2. AWS CDKでインフラストラクチャをデプロイする](#2-aws-cdkでインフラストラクチャをデプロイする)
[3. デバイス情報をAmazon DynamoDBに登録する](#3-デバイス情報をdynamodbに登録する)
[4. シークレットをAWS Secrets Managerに登録する](#4-シークレットをaws-secret-managerに登録する)
[5. デバイスを設定する](#5-デバイスを設定する)
[6. Amazon Managed Grafanaダッシュボードをセットアップする](#6-amazon-managed-grafanaダッシュボードをセットアップする)

### 1. AWS Lambda レイヤーのPython依存関係をインストールする

```bash
pip install -t lib/lambda/layer/open-weather-map/python -r lib/lambda/layer/open-weather-map/requirements.txt
pip install -t lib/lambda/layer/requests/python -r lib/lambda/layer/requests/requirements.txt
```

### 2. AWS CDKでインフラストラクチャをデプロイする

リポジトリのルートディレクトリで以下のコマンドを実行します。

```bash
npm ci
```

AWSアカウントでCDKを初めて使用する場合は、一度[ブートストラップ](https://docs.aws.amazon.com/ja_jp/cdk/v2/guide/bootstrapping.html)する必要があります。アカウントがすでにCDKブートストラップされている場合は、以下のコマンドを実行する必要はありません。

```bash
cdk bootstrap
```

次に、以下のコマンドを実行してAWSリソースをデプロイします。時間がかかる場合があります。

```bash
cdk deploy --all
```

後続の手順で必要になるリソースIDを含むコマンドの出力をメモしてください。
出力例は以下の通りです。

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

### 3. デバイス情報をDynamoDBに登録する

以下のコマンドを実行する前に、次の変更を行ってください：

- {locationTable}を`cdk deploy --all`を実行した後の出力値`SustainableBuilding.DatastorelocationTable~`に置き換えてください。
- [tools/dynamodb/locations_1.json](tools/dynamodb/locations_1.json)と[tools/dynamodb/locations_2.json](tools/dynamodb/locations_2.json)を、あなたの場所とデバイス（SwitchBot Plug MiniとEdgeデバイス）の情報に合わせて修正してください。

```bash
bash tools/dynamodb/add_location.sh {locationTable}
```

### 4. シークレットをAWS Secret Managerに登録する

以下のコマンドを実行する前に、次の変更を行ってください：

- `{secretid}` を`cdk deploy --all`を実行した後の出力値`SustainableBuilding.WeatherDataCollectionOpenWeatherMapApiSecretName~`に置き換えてください。
- {apikey}を[前提条件 - ハードウェア](#ソフトウェア)で取得した[OpenWeather Map APIキー](https://openweathermap.org/appid)に置き換えてください。

```bash
bash tools/secrets-manager/register-openweathermap-secret.sh {secretid} {apikey}
```

### 5. デバイスを設定する

[DEVICE_SETUP](/docs/DEVICE_SETUP-ja.md)を参照してAWS IoT Greengrassデバイスをセットアップしてください。

### 6. Amazon Managed Grafanaダッシュボードをセットアップする

前述の手順に従えば、Amazon Timestreamにデータが蓄積され始めます。
リアルタイムで保存されたAmazon Timestreamデータベースのデータを可視化するためのAmazon Managed Grafanaダッシュボードを構築しましょう。

Amazon Managed Grafanaリソースの作成と使用方法については、[Amazon Managed Grafanaリソースの作成と使用方法を学ぶ](https://docs.aws.amazon.com/grafana/latest/userguide/getting-started-with-AMG.html)を参照してください。

以下は、リソースをセットアップしサンプルダッシュボードを作成するための手順例です。
[AWSマネジメントコンソール](https://aws.amazon.com/jp/console/)にログインした後、これらの手順を実行してください。

1. AWSマネジメントコンソールにログインし、CDKリソースをデプロイしたリージョンを選択します。
2. Amazon Managed Grafanaにアクセスできるユーザーを管理するために[IAM Identity Center](https://docs.aws.amazon.com/console/singlesignon/firstrun/getting-started)をセットアップします。
3. IAM Identity Centerにユーザーを追加します。
4. [Amazon Managed Grafanaワークスペース](https://docs.aws.amazon.com/grafana/latest/userguide/Amazon-Managed-Grafana-setting-up.html)を作成します。以下は設定例のスクリーンショットです。
   Grafana のバージョンを10.4に設定します。
   ![Alt text](/imgs/grafana_dashboard/image.png)
   IAM Identity Center を認証方法として有効化します。
   ![Alt text](/imgs/grafana_dashboard/image-1.png)
   「Turn plugin management」を有効化します。
   ![Alt text](/imgs/grafana_dashboard/image-2.png)

5. Amazon Timestreamをデータソースとして設定します。

   ![Alt text](/imgs/grafana_dashboard/image-3.png)
   ![Alt text](/imgs/grafana_dashboard/image-4.png)

4. ワークスペースに適切な役割（Admin、Viewer）でIAM Identity Centerユーザーを追加します。
   「Assign new user or group」をクリックします。
   ![Alt text](/imgs/grafana_dashboard/image-5.png)
   ![Alt text](/imgs/grafana_dashboard/image-6.png)

5. ワークスペースURLにIAM Identity Centerユーザーでログインします。

6. Amazon Managed GrafanaでAmazon Timestream DBをデータソースとして設定します。
   サイドバーから Apps -> AWS Data Sources -> Data sources を開きます。
   ![Alt text](/imgs/grafana_dashboard/image-7.png)
   AWS services タブで Timestream の「Install now」をクリックします。
   ![Alt text](/imgs/grafana_dashboard/image-8.png)
   右上の「Install [version]」をクリックします。
   ![Alt text](/imgs/grafana_dashboard/image-9.png)
   右上の「Add new data source」をクリックします。
   ![Alt text](/imgs/grafana_dashboard/image-10.png)
   デフォルトのリージョンを設定し、「Save & Test」をクリックします。
   ![Alt text](/imgs/grafana_dashboard/image-11.png)

7. テンプレート([EN](/lib/grafana/dashboard.json), [JP](/lib/grafana/dashboard-jp.json)) からダッシュボードを作成するために[JSONファイルをインポート](https://docs.aws.amazon.com/grafana/latest/userguide/dashboard-export-and-import.html)します。

   ![Alt text](/imgs/grafana_dashboard/image-12.png)
   以下のようなダッシュボードが表示されることを確認します。
   ![Alt test](/imgs/dashboard.png)

## デプロイの検証

### デプロイの検証 - IoTデータ収集

- 以下のスクリーンショットのように、エネルギー使用量、CO2 ppm、温度、気象データなどのすべてのメトリクスがAmazon Managed Grafanaダッシュボードに表示されていることを確認します。

![Alt test](/imgs/dashboard.png)

### デプロイの検証 - IoTデバイスシャドウ

- CO2 ppmがしきい値（デフォルト800 ppm）を超えたときに[IoT ThingsデバイスシャドウShadow](https://docs.aws.amazon.com/ja_jp/iot/latest/developerguide/iot-device-shadows.html)が更新され、サーボを回転させて建物のドアを換気することを確認します。

## ガイダンスの実行

デプロイが完了すると、すべてが自動的に実行されるはずです。これで、Amazon Managed Grafanaダッシュボードを監視し、運用を最適化することでエネルギー、コスト、関連するGHG排出量をどのように最適化できるかをテストできます。

## 次のステップ

このガイダンスの実装例は、複数の建物からエネルギー使用量を最適化するための洞察を得るためのデータ収集、可視化、運用の自動化の基礎を提供します。このサンプルを修正して、あなたの環境に合わせることができます。これには以下が含まれる場合があります：

- エッジデバイスとコンポーネントをカスタマイズし、増やして、ビルディング管理システムやスマートメーターなど他のソースからデータを収集する。
- Amazon AthenaとAmazon QuickSightを使用して、過去のデータ分析とレポート作成を行う。
- AWS IoT TwinMakerを使用してデジタルツインを作成し、物理的な資産の状態を可視化・監視する。

## クリーンアップ

クリーンアップするには、以下の順序でスタックを削除してください：

1. Amazon Managed Grafanaリソース。
2. AWS IAM Identity Center
3. CDKリソース
   AWS CDKによって作成されたリソースを削除するには、以下のコマンドを実行してスタックを削除します。

```bash
cdk destroy --all
```

## FAQ

## 注意事項

_お客様は、本ガイダンスの情報を独自に評価する責任があります。本ガイダンスは：(a) 情報提供のみを目的としており、(b) AWSの現在の製品提供とプラクティスを表しており、予告なく変更される場合があり、(c) AWSおよびその関連会社、サプライヤー、またはライセンサーからのコミットメントや保証を作成するものではありません。AWS製品やサービスは、明示または黙示を問わず、いかなる保証、表明、条件なしに「現状のまま」提供されます。お客様に対するAWSの責任と義務は、AWS契約によって管理され、本文書はAWSとお客様との間のいかなる契約の一部でもなく、それを変更するものでもありません。_

## その他の参考資料

- ブログ: [サステナビリティを意識したミニチュア倉庫のデモを作ってみた !](https://aws.amazon.com/jp/builders-flash/202310/sustainability-factory-demo/)
- ブログ: [スマート x サステナブルビル管理をミニチュア建物で実現してみよう！](https://aws.amazon.com/jp/builders-flash/202411/smart-sustainable-building-management/)

## 著者
本プロジェクトは [佐藤 賢太](https://www.linkedin.com/in/kenta-sato/) にて開発、メンテナンスしています。