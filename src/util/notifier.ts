import aws from "aws-sdk";
import { Topic } from "../enums/topic";
import { config } from "../config";

export interface Messenger {
  send(code: string, phoneNumber?: string, destinationEmail?: string): void;
}

export class Texter implements Messenger {
  private readonly texter: aws.SNS;
  private readonly phoneNumberRegex: RegExp = /^\+\d{1,15}$/;
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
    if (!this.validate(code, phoneNumber as string)) {
      console.warn(
        "One or more values was not valid... aborting sending text message"
      );
      return;
    }
    const params = {
      Message: `Thank you for using BunkedUp as your roommate finder, your verification code is ${code}`,
      PhoneNumber: phoneNumber,
    };
    this.texter.publish(params, (err, data) => {
      if (err) console.error("Error sending mfa text: %d", err.message);
      else console.log("Sent mfa text for code: %d", code);
    });
  }
  private validate: (code: string, phoneNumber: string) => boolean = (
    code,
    phoneNumber
  ) => {
    let result: boolean = false;
    result = this.phoneNumberRegex.test(phoneNumber);
    return result;
  };
}

export class Mailer implements Messenger {
  private readonly mailer: aws.SES;
  private readonly state: "MFA" | "REGISTRATION";
  private readonly emailRegex: RegExp =
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
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
    const sourceEmail = config.SOURCE_EMAIL as string;
    if (!this.validate(code, destinationEmail as string, sourceEmail)) {
      console.warn(
        "One or more values was not valid... aborting sending email."
      );
      return;
    }
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
      Source: sourceEmail,
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
  private validate: (code: string, ...email: string[]) => boolean = (
    code,
    email
  ) => {
    let result: boolean = false;
    if (email.length > 1) {
      for (const e of email) result = this.emailRegex.test(e);
    } else {
      result = this.emailRegex.test(email);
    }
    return result;
  };
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
