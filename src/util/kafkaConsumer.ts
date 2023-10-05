import kafka from "node-rdkafka";
import { Topic } from "../enums/topic";
import { AwsStorage, Message, SavableMessage } from "./storage";
import { Db, ObjectId } from "mongodb";
import { NotifierFactory } from "./notifier";

export interface Consumer {
  run(s3: AwsStorage, mongo: Db, notifierFactory: NotifierFactory): void;
}

export class BrokerConsumer implements Consumer {
  private readonly topics: Topic[];
  private readonly consumer: kafka.KafkaConsumer;

  constructor(topics: Topic[], groupId: string, host: string) {
    if (groupId.trim().length == 0 || host.trim().length == 0) {
      throw new Error(
        "Invalid arguments for Broker constructor.... please make sure all items are valid..."
      );
    }
    this.consumer = new kafka.KafkaConsumer(
      {
        "group.id": groupId,
        "metadata.broker.list": `${host}:9092`,
      },
      {}
    );
    this.topics = topics;
  }
  run(s3: AwsStorage, mongoDb: Db, notifierFactory: NotifierFactory): void {
    if (!this.consumer.isConnected()) this.connectToCluster();
    this.consumer.on("data", (data) => {
      switch (data.topic) {
        case Topic.CREATE_ROOM.valueOf():
          const referenceKey = JSON.parse("");
          console.log("Creating instance in db for:", referenceKey);
          const collection = mongoDb.collection("");
          const doc = {
            reference_id: referenceKey,
            messages: [],
          };
          collection.insertOne(doc);
          break;

        case Topic.DELETE_ROOM.valueOf():
          const key = JSON.parse("");
          console.log("Deleting instance in db for:", key);
          break;

        case Topic.SAVE_MESSAGE.valueOf():
          const obj: { roomId: ObjectId; message: Message } = JSON.parse("");
          console.log("Saving message in db for :", obj.roomId);
          const hash: string[] = s3.upload(
            obj.message.photos,
            obj.message.mimeType
          );
          const messageDoc: SavableMessage = {
            senderId: obj.message.senderId,
            photoKeys: hash,
            createdAt: obj.message.createdAt,
            sender: obj.message.sender,
            text: obj.message.text,
          };
          const update = {
            $push: {
              messages: messageDoc,
            },
          };
          const collectionToSaveMessage = mongoDb.collection("");
          collectionToSaveMessage.updateOne({ _id: obj.roomId }, update);
          break;

        case Topic.SEND_MFA_EMAIL.valueOf():
          const mfaEmailCode: { code: string; email: string } = JSON.parse("");
          const mfaEmailer = notifierFactory.getClass(Topic.SEND_MFA_EMAIL);
          if (mfaEmailer)
            mfaEmailer.send(mfaEmailCode.code, undefined, mfaEmailCode.email);
          break;

        case Topic.SEND_MFA_TEXT.valueOf():
          const mfaTextCode: { code: string; phoneNumber: string } =
            JSON.parse("");
          const mfaTexter = notifierFactory.getClass(Topic.SEND_MFA_EMAIL);
          if (mfaTexter)
            mfaTexter.send(mfaTextCode.code, mfaTextCode.phoneNumber);
          break;

        case Topic.SEND_REGISTRATION_EMAIL.valueOf():
          const registrationCode: { code: string; email: string } =
            JSON.parse("");
          const registrationEmailer = notifierFactory.getClass(
            Topic.SEND_REGISTRATION_EMAIL
          );
          if (registrationEmailer)
            registrationEmailer.send(
              registrationCode.code,
              undefined,
              registrationCode.email
            );
          break;

        default:
          console.warn(
            "Data from queue has been read, but topic value was not found:",
            data.topic
          );
      }
    });
  }

  private connectToCluster: () => void = () => {
    this.consumer.connect();
    this.consumer.on("ready", () => {
      console.log("Broker is connected and ready....");
      console.log(`Subscribing to ${this.topics}....`);
      this.consumer.subscribe(this.topics);
      console.log("Consuming messages....");
      this.consumer.consume();
    });
  };
}
