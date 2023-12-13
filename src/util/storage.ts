import aws from "aws-sdk";
import crypto from "crypto";
import { config } from "../config";
import { ObjectId } from "mongodb";

export type Message = {
  senderId: ObjectId;
  sender: string;
  text: string;
  photos: Buffer[];
  mimeType: string;
  createdAt: number;
};

export type SavableMessage = {
  senderId: ObjectId;
  sender: string;
  text: string;
  photoKeys: string[];
  createdAt: number;
};

export interface Storage {
  upload(message: Buffer[], mimeType: string, encryption: string): string[];
  delete(key: string): void;
  generateSignedUrl(key: string): string;
}
export class AwsStorage implements Storage {
  private readonly s3: aws.S3;
  private readonly bucket: string;
  private readonly expiration: number;
  constructor(
    accessKey: string,
    secretKey: string,
    region: string,
    bucket: string,
    expiration: number
  ) {
    if (
      accessKey.trim().length == 0 ||
      secretKey.trim().length == 0 ||
      region.trim().length == 0 ||
      bucket.trim().length == 0 ||
      expiration == 0
    ) {
      throw new Error(
        "Invalid constructor for aws storage... please make sure all items are valid..."
      );
    }
    this.s3 = new aws.S3({
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      region: region,
    });
    this.bucket = bucket;
    this.expiration = expiration;
  }
  upload(
    photoBufferArray: Buffer[],
    mimeType: string,
    encryption: string = ""
  ): string[] {
    const hashKeys: string[] = [];
    for (const photoBuffer of photoBufferArray) {
      const hashKey = crypto.randomBytes(config.HASH_SALT).toString("hex");
      const params = {
        Bucket: this.bucket,
        ContentType: mimeType,
        Key: hashKey,
        Body: photoBuffer,
        ServerSideEncryption: encryption,
      };
      const managedUpload = this.s3.upload(params);
      managedUpload.send((err, data) => {
        if (err)
          console.error("There was an error uploading to s3: ", err.message);
        else {
          console.log(
            "Successfully uploaded photo to s3 location: ",
            data.Location
          );
          hashKeys.push(hashKey);
        }
      });
    }
    return hashKeys;
  }
  delete(key: string): void {
    const params = {
      Bucket: this.bucket,
      Key: key,
    };
    const managedDeletion = this.s3.deleteObject(params);
    managedDeletion.promise().then((result) => {
      if (result.$response.httpResponse.statusCode != 200)
        console.warn(
          "Object was not deleted from the s3 bucket with key: ",
          key
        );
      else console.log("Object was deleted from bucket with key: ", key);
    });
  }

  generateSignedUrl: (key: string) => string = (key) => {
    const params = {
      Bucket: this.bucket,
      Key: key,
      Expires: this.expiration,
    };
    const presignedUrl = this.s3.getSignedUrl("getObject", params);
    return presignedUrl;
  };
}
