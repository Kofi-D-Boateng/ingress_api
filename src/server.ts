import { Db } from "mongodb";
import { Topic } from "./enums/topic";
import { DatabaseSingleton } from "./util/databaseSingleton";
import { BrokerConsumer } from "./util/kafkaConsumer";
import { AwsStorage } from "./util/storage";
import { config } from "./config";
import { NotificationFactory } from "./util/notifier";
if (process.env.ENV == "env") import("dotenv").then((d) => d.config());

const topics: Topic[] = [
  Topic.CREATE_ROOM,
  Topic.DELETE_ROOM,
  Topic.SAVE_MESSAGE,
  Topic.SEND_MFA_EMAIL,
  Topic.SEND_MFA_TEXT,
  Topic.SEND_REGISTRATION_EMAIL,
];

const awsParams = process.env.ENV == "prod" ? config.PROD_AWS : config.DEV_AWS;
const consumer: BrokerConsumer = new BrokerConsumer(
  topics,
  config.KAFKA_GROUP_ID,
  config.HOST,
  awsParams.S3.ENCRYPTION || ""
);
const s3: AwsStorage = new AwsStorage(
  awsParams.ACCESS_KEY || "",
  awsParams.SECRET_KEY || "",
  awsParams.REGION || "",
  awsParams.S3.BUCKET_NAME || "",
  awsParams.S3.EXPIRATION
);
const factory = new NotificationFactory(
  awsParams.ACCESS_KEY || "",
  awsParams.SECRET_KEY || "",
  awsParams.REGION || ""
);
setInterval(async () => {
  if (consumer.isReady) {
    const db: Db = await DatabaseSingleton.getDbInstance();
    consumer.run(s3, db, factory);
  }
}, 10000);

process.on("SIGINT", () => consumer.stop());
