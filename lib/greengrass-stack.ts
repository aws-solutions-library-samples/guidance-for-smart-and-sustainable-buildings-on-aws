import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { GdkBucket } from "./construct/gdk-publish/gdk-bucket";
import * as path from "path";
import { GreengrassBootstrap } from "./construct/greengrass-bootstrap";
import {
  PythonGdkPublish,
  PythonVersion,
} from "./construct/gdk-publish/python-gdk-publish";

export class GreengrassStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create S3 bucket to store GDK components in this example.
    const greengrassComponentBucket = new GdkBucket(
      this,
      "GreengrassComponentBucket",
      {
        gdkConfigPath: path.join(
          __dirname,
          "./gg_components/sensor-data-collection/gdk-config.json",
        ),
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
      },
    );

    // Create resources to use Greengrass.
    new GreengrassBootstrap(this, "SensingDevice1", {
      componentBuckets: [greengrassComponentBucket],
      deployDevTools: true,
      thingName: "SensingDevice1",
    });

    new GreengrassBootstrap(this, "SensingDevice2", {
      componentBuckets: [greengrassComponentBucket],
      deployDevTools: true,
      thingName: "SensingDevice2",
    });
    // GDK publish for Python component to send data to IoT Core.
    const sensorDataCollectionComponentPublish = new PythonGdkPublish(
      this,
      "sensorDataCollectionComponentPublish",
      {
        componentBucket: greengrassComponentBucket,
        asset: {
          path: path.join(__dirname, "./gg_components/sensor-data-collection/"),
        },
        pythonVersion: PythonVersion.PYTHON_3_12,
        gdkVersion: "v1.6.2",
      },
    );

    // GDK publish for Python component to send data to IoT Core.
    const automateVentilationComponentPublish = new PythonGdkPublish(
      this,
      "automateVentilationComponentPublish",
      {
        componentBucket: greengrassComponentBucket,
        asset: {
          path: path.join(__dirname, "./gg_components/automate-ventilation/"),
        },
        pythonVersion: PythonVersion.PYTHON_3_12,
        gdkVersion: "v1.6.2",
      },
    );

    new cdk.CfnOutput(this, "sensorDataCollectionComponentName", {
      value: sensorDataCollectionComponentPublish.componentName,
    });

    new cdk.CfnOutput(this, "sensorDataCollectionComponentVersion", {
      value: sensorDataCollectionComponentPublish.componentVersion,
    });

    new cdk.CfnOutput(this, "AutomateVentilationComponentName", {
      value: automateVentilationComponentPublish.componentName,
    });

    new cdk.CfnOutput(this, "AutomateVentilationComponentVersion", {
      value: automateVentilationComponentPublish.componentVersion,
    });

    this.templateOptions.description = "Solution ID: SO9189";
  }
}
