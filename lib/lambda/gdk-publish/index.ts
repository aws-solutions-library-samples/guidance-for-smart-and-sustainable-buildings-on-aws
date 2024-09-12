import { CodeBuildClient, StartBuildCommand } from "@aws-sdk/client-codebuild";
import type { ResourceProperties } from "../../lib/constructs/gdk-publish/gdk-publish";
import {
  GreengrassV2Client,
  DeleteComponentCommand,
} from "@aws-sdk/client-greengrassv2";

const cb = new CodeBuildClient({});
const gg = new GreengrassV2Client({});

type Event = {
  RequestType: "Create" | "Update" | "Delete";
  ResponseURL: string;
  StackId: string;
  RequestId: string;
  ResourceType: string;
  LogicalResourceId: string;
  PhysicalResourceId: string;
  ResourceProperties: ResourceProperties;
};

export const handler = async (event: Event, context: any) => {
  console.log(JSON.stringify(event));

  const props = event.ResourceProperties;
  // const region = process.env.AWS_REGION || "";
  // const accountId = context.invokedFunctionArn.split(":")[4];

  try {
    if (event.RequestType == "Create" || event.RequestType == "Update") {
      // Start code build project
      const build = await cb.send(
        new StartBuildCommand({
          projectName: props.codeBuildProjectName,
          environmentVariablesOverride: [
            {
              name: "assetUrl",
              value: `s3://${props.sourceBucketName}/${props.sourceObjectKey}`,
            },
            {
              name: "extractPath",
              value: props.extractPath,
            },
            {
              name: "projectName",
              value: props.codeBuildProjectName,
            },
            {
              name: "responseURL",
              value: event.ResponseURL,
            },
            {
              name: "stackId",
              value: event.StackId,
            },
            {
              name: "requestId",
              value: event.RequestId,
            },
            {
              name: "logicalResourceId",
              value: event.LogicalResourceId,
            },
            {
              name: "componentName",
              value: props.componentName,
            },
            ...Object.entries(props.environment ?? {}).map(([name, value]) => ({
              name,
              value,
            })),
          ],
        }),
      );
      // Sometimes CodeBuild build fails before running buildspec, without calling the CFn callback.
      // We can poll the status of a build for a few minutes and sendStatus if such errors are detected.
      // if (build.build?.id == null) {
      //   throw new Error('build id is null');
      // }

      // for (let i=0; i< 20; i++) {
      //   const res = await cb.send(new BatchGetBuildsCommand({ ids: [build.build.id] }));
      //   const status = res.builds?.[0].buildStatus;
      //   if (status == null) {
      //     throw new Error('build status is null');
      //   }

      //   await new Promise((resolve) => setTimeout(resolve, 5000));
      // }
    } else {
      const arn = event.PhysicalResourceId;

      // If want to delete previous greengrass component version, please comment out
      // await gg.send(
      //   new DeleteComponentCommand({
      //     arn: arn,
      //   })
      // );

      await sendStatus("SUCCESS", event, context, arn);
    }
  } catch (e) {
    console.log(e);
    const err = e as Error;
    await sendStatus("FAILED", event, context, "", err.message);
  }
};

const sendStatus = async (
  status: "SUCCESS" | "FAILED",
  event: Event,
  context: any,
  latestArn: string,
  reason?: string,
) => {
  const componentVersion = latestArn.split(":")[8];
  const responseBody = JSON.stringify({
    Status: status,
    Reason:
      reason ??
      "See the details in CloudWatch Log Stream: " + context.logStreamName,
    PhysicalResourceId: latestArn,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    NoEcho: false,
    Data: {
      componentVersion,
    }, //responseData
  });

  await fetch(event.ResponseURL, {
    method: "PUT",
    body: responseBody,
    headers: {
      "Content-Type": "",
      "Content-Length": responseBody.length.toString(),
    },
  });
};
