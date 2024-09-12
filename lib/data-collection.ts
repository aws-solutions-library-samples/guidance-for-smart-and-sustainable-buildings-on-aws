import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { DataStore } from "./construct/datastore";
import { WeatherDataCollection } from "./construct/weather-data-collection";
import { PowerDataCollection } from "./construct/power-data-collection";
import { SensorDataCollection } from "./construct/iot";

export class SustainableBuilding extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const databaseName = "sustainableBuilding";
    const sensorTableName = "sensor";
    const powerTableName = "power";
    const weatherTableName = "weather";

    const datastore = new DataStore(this, "Datastore", {
      databaseName: databaseName,
      sensorTableName: sensorTableName,
      powerTableName: powerTableName,
      weatherTableName: weatherTableName,
    });
    new WeatherDataCollection(this, "WeatherDataCollection", {
      locationTable: datastore.locationTable,
      databaseName: databaseName,
      weatherTableName: weatherTableName,
    });
    new PowerDataCollection(this, "PowerDataCollection", {
      locationTable: datastore.locationTable,
      databaseName: databaseName,
      powerTableName: powerTableName,
    });
    new SensorDataCollection(this, "SensorDataCollection", {
      locationTable: datastore.locationTable,
      databaseName: databaseName,
      sensorTableName: sensorTableName,
    });
  }
}
