import { Db } from "mongodb";
import { Topic } from "./enums/topic";
import { DatabaseSingleton } from "./util/databaseSingleton";
import { BrokerConsumer, Consumer } from "./util/kafkaConsumer";
import { AwsStorage } from "./util/storage";
import { config } from "./config";

const topics: Topic[] = [
  Topic.CREATE_ROOM,
  Topic.DELETE_ROOM,
  Topic.SAVE_IMAGE_TO_S3,
  Topic.SAVE_MESSAGE,
];

const awsParams = process.env.ENV == "prod" ? config.PROD_AWS : config.DEV_AWS;
const consumer: Consumer = new BrokerConsumer(
  topics,
  config.KAFKA_GROUP_ID,
  config.HOST
);
const s3: AwsStorage = new AwsStorage(
  awsParams.ACCESS_KEY || "",
  awsParams.SECRET_KEY || "",
  awsParams.REGION || "",
  awsParams.S3.BUCKET_NAME || "",
  awsParams.S3.EXPIRATION
);
setInterval(async () => {
  const db: Db = await DatabaseSingleton.getDbInstance();
  consumer.run(s3, db);
}, 5000);
