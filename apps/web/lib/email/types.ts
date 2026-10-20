export type EmailPayload = {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  fromName?: string;
};

export type EmailSendResult =
  | { sent: true; messageId?: string }
  | { sent: false; reason: "disabled" | "error"; error?: string };
