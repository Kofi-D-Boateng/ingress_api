export const config = {
  HASH_SALT: 10,
  HOST: process.env.HOST_IP || "localhost",
  PROD_AWS: {
    SECRET_KEY: process.env.PROD_AWS_SECRET_KEY,
    ACCESS_KEY: process.env.PROD_AWS_ACCESS_KEY,
    REGION: process.env.PROD_AWS_REGION,
    S3: {
      BUCKET_NAME: process.env.PROD_BUCKET_NAME,
      EXPIRATION: process.env.PROD_PRESIGNED_EXPIRATION
        ? parseInt(process.env.PROD_PRESIGNED_EXPIRATION)
        : 0,
      ENCRYPTION: process.env.S3_ENCRYPTION,
    },
  },
  DEV_AWS: {
    SECRET_KEY: process.env.DEV_AWS_SECRET_KEY,
    ACCESS_KEY: process.env.DEV_AWS_ACCESS_KEY,
    REGION: process.env.DEV_AWS_REGION,
    S3: {
      BUCKET_NAME: process.env.DEV_BUCKET_NAME,
      EXPIRATION: process.env.DEV_PRESIGNED_EXPIRATION
        ? parseInt(process.env.DEV_PRESIGNED_EXPIRATION)
        : 0,
      ENCRYPTION: process.env.S3_ENCRYPTION,
    },
  },
  PROD_MONGO: {
    CONN_STR: process.env.PROD_MONGO_CONNECTION_STRING,
    DB: process.env.PROD_MONGO_DB_NAME,
    COLLECTION_NAME: process.env.PROD_MONGO_MESSAGE_COLLECTION,
  },
  DEV_MONGO: {
    CONN_STR: process.env.DEV_MONGO_CONNECTION_STRING,
    DB: process.env.DEV_MONGO_DB_NAME,
    COLLECTION_NAME: process.env.DEV_MONGO_MESSAGE_COLLECTION,
  },
  KAFKA_GROUP_ID: process.env.KAFKA_GROUP_ID || "",
  SOURCE_EMAIL: process.env.NO_REPLY_EMAIL,
};
