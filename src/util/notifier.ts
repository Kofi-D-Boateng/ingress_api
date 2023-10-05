import aws from "aws-sdk";
import { Topic } from "../enums/topic";
import { config } from "../config";

export interface Messenger {
  send(code: string, phoneNumber?: string, destinationEmail?: string): void;
}

export class Texter implements Messenger {
  private readonly texter: aws.SNS;
  constructor(accessKey: string, secretKey: string, region: string) {
    this.texter = new aws.SNS({
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      region: region,
    });
  }
  send(
    code: string,
    phoneNumber?: string | undefined,
    destinationEmail?: string | undefined
  ): void {
    const params = {
      Message: `Thank you for using BunkedUp as your roommate finder, your verification code is ${code}`,
      PhoneNumber: phoneNumber,
    };
    this.texter.publish(params, (err, data) => {
      if (err) console.error("Error sending mfa text: %d", err.message);
      else console.log("Sent mfa text for code: %d", code);
    });
  }
}

export class Mailer implements Messenger {
  private readonly mailer: aws.SES;
  private readonly state: "MFA" | "REGISTRATION";
  constructor(
    accessKey: string,
    secretKey: string,
    region: string,
    state: "MFA" | "REGISTRATION"
  ) {
    this.mailer = new aws.SES({
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      region: region,
    });
    this.state = state;
  }
  send(
    code: string,
    phoneNumber?: string | undefined,
    destinationEmail?: string | undefined
  ): void {
    const message =
      this.state == "MFA"
        ? `Your MFA code is ${code}`
        : `Thank you for registering with BunkedUp! Before you can use our application please verify your account by clicking the link below\n\nwww.bunkedup.com/verifyme?code=${code}`;
    const subject =
      this.state == "MFA"
        ? "Multi-Factor"
        : "Thank you for registering with BunkedUp";

    const params = {
      Destination: {
        ToAddresses: [destinationEmail as string],
      },
      Message: {
        Body: {
          Text: {
            Data: message,
          },
        },
        Subject: {
          Data: subject,
        },
      },
      Source: config.SOURCE_EMAIL as string,
    };

    this.mailer.sendEmail(params, (err, data) => {
      if (err)
        console.error(
          "Error sending email in state %d.... err: %d",
          this.state,
          err.message
        );
    });
  }
}

export interface NotifierFactory {
  getClass(topic: Topic): Messenger | undefined;
}

export class NotificationFactory implements NotifierFactory {
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly region: string;
  constructor(accessKey: string, secretKey: string, region: string) {
    if (
      accessKey.trim().length == 0 ||
      secretKey.trim().length == 0 ||
      region.trim().length == 0
    ) {
      throw new Error(
        "Invalid constructor for notification factory.... please make sure all items are valid..."
      );
    }
    this.accessKey = accessKey;
    this.secretKey = secretKey;
    this.region = region;
  }
  getClass(
    topic: Topic,
    state?: "MFA" | "REGISTRATION"
  ): Messenger | undefined {
    switch (topic) {
      case Topic.SEND_MFA_EMAIL || Topic.SEND_REGISTRATION_EMAIL:
        return new Mailer(
          this.accessKey,
          this.secretKey,
          this.region,
          state ? state : "MFA"
        );
      case Topic.SEND_MFA_TEXT:
        return new Texter(this.accessKey, this.secretKey, this.region);
      default:
        console.warn("Class could not be created based on topic: %d", topic);
        return undefined;
    }
  }
}
