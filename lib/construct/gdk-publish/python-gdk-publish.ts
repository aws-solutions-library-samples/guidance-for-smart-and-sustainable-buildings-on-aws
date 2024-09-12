import { Construct } from "constructs";
import { GdkPublish, GdkPublishProps } from "./gdk-publish";
import { Annotations } from "aws-cdk-lib";

export enum PythonVersion {
  PYTHON_3_7 = "3.7",
  PYTHON_3_8 = "3.8",
  PYTHON_3_9 = "3.9",
  PYTHON_3_10 = "3.10",
  PYTHON_3_11 = "3.11",
  PYTHON_3_12 = "3.12",
}
export interface PythonGdkPublishProps extends GdkPublishProps {
  /**
   * Python version used in CodeBuild project.
   * @default 3.12
   */
  readonly pythonVersion?: PythonVersion;
}

export class PythonGdkPublish extends GdkPublish {
  constructor(scope: Construct, id: string, props: PythonGdkPublishProps) {
    const { pythonVersion = "3.12" } = props;
    let buildImage = "aws/codebuild/standard:5.0";
    // ref: https://docs.aws.amazon.com/codebuild/latest/userguide/available-runtimes.html#linux-runtimes
    switch (pythonVersion) {
      case "3.7":
      case "3.8":
      case "3.9":
        buildImage = "aws/codebuild/standard:5.0";
        break;
      case "3.10":
        buildImage = "aws/codebuild/standard:6.0";
        break;
      case "3.11":
        buildImage = "aws/codebuild/standard:7.0";
        break;
      case "3.12":
        buildImage = "aws/codebuild/standard:7.0";
        break;
      default:
        Annotations.of(scope).addError(
          `Unsupported Python version: ${pythonVersion}`,
        );
    }

    super(scope, id, {
      ...props,
      buildImage: buildImage,
      runtimeVersions: { python: pythonVersion },
    });
  }
}
