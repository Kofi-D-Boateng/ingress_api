import kafka from "node-rdkafka";
import { Topic } from "../enums/topic";
import { AwsStorage, Message, SavableMessage } from "./storage";
import { Db, ObjectId } from "mongodb";
import { NotifierFactory } from "./notifier";

export interface Consumer {
  run(s3: AwsStorage, mongo: Db, notifierFactory: NotifierFactory): void;
  stop(): void;
}

export class BrokerConsumer implements Consumer {
  private readonly topics: Topic[];
  private readonly consumer: kafka.KafkaConsumer;
  public isReady: boolean = true;

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
    this.isReady = false;
    this.consumer.on("ready", () => {
      console.log("Broker is connected and ready....");
      console.log(`Subscribing to ${this.topics}....`);
      this.consumer.subscribe(this.topics);
      this.consumer.consume();
    });
    this.consumer.on("data", (data) => {
      console.log("Consuming messages....");
      switch (data.topic) {
        case Topic.CREATE_ROOM.valueOf():
          const kafkaMessage: string | undefined = data.value?.toString();

          if (!kafkaMessage) {
            console.warn(
              "Attempted to read a message for topic: %d, but there was not a message",
              Topic.CREATE_ROOM
            );
            return;
          }
          const referenceKey: ObjectId = JSON.parse(kafkaMessage);

          if (!ObjectId.isValid(referenceKey)) {
            console.error(
              "The reference key sent with this message is not a valid id... ['%d']",
              referenceKey
            );
            return;
          }

          console.log("Creating instance in db for:", referenceKey);

          const collectionToInsertIn = mongoDb.collection("");
          const doc = {
            reference_id: referenceKey,
            messages: [],
          };
          const insertResult = collectionToInsertIn.insertOne(doc);
          insertResult
            .then((result) => {
              if (!result.acknowledged) {
                console.warn(
                  "While attempting an insertion, the write was not acknowledged. Key: %d",
                  referenceKey
                );
              }
            })
            .catch((err) =>
              console.error(
                "Error when trying to complete an insertion into the database: %d\n",
                err
              )
            );
          break;

        case Topic.DELETE_ROOM.valueOf():
          const deleteionKey: string | undefined = data.value?.toString();

          if (!deleteionKey) {
            console.warn(
              "Attempted to read a message for topic: %d, but there was not a message",
              Topic.DELETE_ROOM
            );
            return;
          }

          const key: ObjectId = JSON.parse(deleteionKey);

          console.log("Deleting instance in db for:", key);

          const collectionToDeleteFrom = mongoDb.collection("");

          const deletionResult = collectionToDeleteFrom.deleteOne({
            _id: key,
          });
          deletionResult
            .then((result) => {
              if (!result.acknowledged) {
                console.warn(
                  "While attempting a deletion, the write was not acknowledged. Key: %d",
                  key
                );
              }
            })
            .catch((err) =>
              console.error(
                "Error when trying to complete a deletion from the database: %d\n",
                err
              )
            );
          break;

        case Topic.SAVE_MESSAGE.valueOf():
          const messageToBeSave: string | undefined = data.value?.toString();

          if (!messageToBeSave) {
            console.warn(
              "Attempted to read a message for topic: %d, but there was not a message",
              Topic.SAVE_MESSAGE
            );
            return;
          }

          const obj: { roomId: ObjectId; message: Message } =
            JSON.parse(messageToBeSave);
          if (
            !ObjectId.isValid(obj.roomId) ||
            ObjectId.isValid(obj.message.senderId)
          ) {
            console.error(
              "The roomId or the Message id sent along with this message is not a valid id... ['%d','%d']",
              obj.roomId,
              obj.message.senderId
            );
            return;
          }

          console.log("Saving message in db for :", obj.roomId);

          const hashes: string[] = s3.upload(
            obj.message.photos,
            obj.message.mimeType
          );
          const messageDoc: SavableMessage = {
            senderId: obj.message.senderId,
            photoKeys: hashes,
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
          const r = collectionToSaveMessage.updateOne(
            { _id: obj.roomId },
            update
          );
          r.then((u) => {
            if (!u.acknowledged) {
              console.error("Error saving a message to the database...");
            }
          }).catch((err) =>
            console.error(
              "Error when trying to complete an update into the database: %d\n",
              err
            )
          );
          break;

        case Topic.SEND_MFA_EMAIL.valueOf():
          const mfaEmailMessage = data.value?.toString();

          if (!mfaEmailMessage) {
            console.warn(
              "Attempted to read a message for topic: %d, but there was not a message",
              Topic.SEND_MFA_EMAIL
            );
            return;
          }

          const mfaEmailCode: { code: string; email: string } =
            JSON.parse(mfaEmailMessage);
          const mfaEmailer = notifierFactory.getClass(Topic.SEND_MFA_EMAIL);
          if (mfaEmailer) {
            mfaEmailer.send(mfaEmailCode.code, undefined, mfaEmailCode.email);
          } else {
            console.warn(
              "Could not retrieve emailer from notifierFactory.... "
            );
          }
          break;

        case Topic.SEND_MFA_TEXT.valueOf():
          const mfaTextMessage = data.value?.toString();

          if (!mfaTextMessage) {
            console.warn(
              "Attempted to read a message for topic: %d, but there was not a message",
              Topic.SEND_MFA_TEXT
            );
            return;
          }
          const mfaTextCode: { code: string; phoneNumber: string } =
            JSON.parse(mfaTextMessage);
          const mfaTexter = notifierFactory.getClass(Topic.SEND_MFA_EMAIL);
          if (mfaTexter) {
            mfaTexter.send(mfaTextCode.code, mfaTextCode.phoneNumber);
          } else {
            console.warn(
              "Could not retrieve the texter from the notifier factory...."
            );
          }
          break;

        case Topic.SEND_REGISTRATION_EMAIL.valueOf():
          const registrationEmailMessage = data.value?.toString();
          if (!registrationEmailMessage) {
            console.warn(
              "Attempted to read a message for topic: %d, but there was not a message",
              Topic.SEND_REGISTRATION_EMAIL
            );
            return;
          }
          const registrationCode: { code: string; email: string } = JSON.parse(
            registrationEmailMessage
          );
          const registrationEmailer = notifierFactory.getClass(
            Topic.SEND_REGISTRATION_EMAIL
          );

          if (registrationEmailer) {
            registrationEmailer.send(
              registrationCode.code,
              undefined,
              registrationCode.email
            );
          } else {
            console.warn(
              "Could not retrieve the emailer from the notifier factory...."
            );
          }
          break;

        default:
          console.warn(
            "Data from queue has been read, but topic value was not found: %d",
            data.topic
          );
      }
      this.isReady = true;
    });
  }

  stop(): void {
    this.consumer.disconnect();
  }

  private connectToCluster: () => void = () => {
    this.consumer.connect();
  };
}
