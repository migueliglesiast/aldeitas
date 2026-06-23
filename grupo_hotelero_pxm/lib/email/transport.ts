import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { getEmailConfig } from "@/lib/email/config";

let cachedTransport: Transporter | null | undefined;

export function getEmailTransport(): Transporter | null {
  if (cachedTransport !== undefined) return cachedTransport;

  const config = getEmailConfig();
  if (!config) {
    cachedTransport = null;
    return null;
  }

  cachedTransport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    tls: {
      minVersion: "TLSv1.2",
    },
  });

  return cachedTransport;
}

export function resetEmailTransportCache() {
  cachedTransport = undefined;
}
