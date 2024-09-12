import * as fs from "fs";

interface GdkSchema {
  component: {
    [key: string]: {
      publish: {
        bucket: string;
        region: string;
      };
    };
  };
  gdk_version: string;
}

export class GdkConfig {
  private readonly schema: GdkSchema;
  constructor(path: string) {
    const fileContent = fs.readFileSync(path, "utf-8");
    this.schema = JSON.parse(fileContent);
  }

  get componentName() {
    for (const componentName in this.schema.component) {
      if (this.schema.component.hasOwnProperty(componentName)) {
        return componentName;
      }
    }
    throw new Error("no component found.");
  }

  get region() {
    for (const componentName in this.schema.component) {
      if (this.schema.component.hasOwnProperty(componentName)) {
        const region = this.schema.component[componentName].publish.region;
        return region;
      }
    }
    throw new Error("no component found.");
  }

  get bucketName() {
    for (const componentName in this.schema.component) {
      if (this.schema.component.hasOwnProperty(componentName)) {
        const bucketName = this.schema.component[componentName].publish.bucket;
        return bucketName;
      }
    }
    throw new Error("no component found.");
  }
}
