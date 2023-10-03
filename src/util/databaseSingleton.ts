import { Db, MongoClient } from "mongodb";
import { config } from "../config";

const mongoParams =
  process.env.ENV == "prod" ? config.PROD_MONGO : config.DEV_MONGO;

export class DatabaseSingleton {
  private static instance: DatabaseSingleton;
  private static readonly client: MongoClient = new MongoClient(
    mongoParams.CONN_STR as string
  );
  public static readonly mongoObject = {};
  constructor() {
    if (!DatabaseSingleton.instance) {
      DatabaseSingleton.instance = this;
    }
    return DatabaseSingleton.instance;
  }

  public static getInstance(): DatabaseSingleton {
    if (!DatabaseSingleton.instance) {
      DatabaseSingleton.instance = new DatabaseSingleton();
    }
    return DatabaseSingleton.instance;
  }

  public static async getDbInstance(): Promise<Db> {
    if (!DatabaseSingleton.instance) {
      DatabaseSingleton.instance = new DatabaseSingleton();
    }
    await DatabaseSingleton.client.connect();
    console.log("Connected successfully to mongo database");
    return DatabaseSingleton.client.db(mongoParams.DB);
  }
}
