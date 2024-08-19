import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as path from "path";
import { GdkConfig } from "./gdk-config";
import { Stack } from "aws-cdk-lib";

export interface GdkBucketProps extends s3.BucketProps {
  /**
   * Path to gdk-config.json
   */
  gdkConfigPath: string;
}

export class GdkBucket extends s3.Bucket {
  constructor(scope: Construct, id: string, props: GdkBucketProps) {
    const config = new GdkConfig(path.join(props.gdkConfigPath));

    // GDK tries to generate S3 bucket according to bucket name on `gdk-config.json` if not exists.
    // The bucket should be under the control of CDK, so declare bucket here.
    // Please note that bucket naming rule on gdk is: {bucket name}-{region}-{account}
    const bucketName = `${config.bucketName}-${config.region}-${
      Stack.of(scope).account
    }`.toLowerCase();

    // Create a separate bucket for storing access logs
    const logBucket = new s3.Bucket(scope, "GdkLogBucket", {
      bucketName: `${bucketName}-logs`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: props.removalPolicy,
      autoDeleteObjects: props.autoDeleteObjects,
    });

    super(scope, id, {
      ...props,
      bucketName,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      serverAccessLogsBucket: logBucket,
      serverAccessLogsPrefix: "logs",
    });
  }
}
