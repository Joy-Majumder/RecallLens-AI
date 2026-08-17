/**
 * Email channel — Resend in production, console.log in dev.
 *
 * If RESEND_API_KEY is not set we log to stdout instead of failing, so
 * local dev doesn't break the notification job.
 */
import { Resend } from "resend";

let cachedClient: Resend | null = null;

function getClient(): Resend | null {
  if (cachedClient) return cachedClient;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  cachedClient = new Resend(key);
  return cachedClient;
}

export async function sendEmail(args: {
  to: string;
  subject: string;
  body: string;
}): Promise<void> {
  const from = process.env.NOTIFICATION_FROM_EMAIL ?? "alerts@recalllens.ai";
  const client = getClient();

  if (!client) {
    console.log(
      `[email/console] to=${args.to} subject="${args.subject}"\n${args.body}\n---`
    );
    return;
  }

  const { error } = await client.emails.send({
    from,
    to: args.to,
    subject: args.subject,
    text: args.body,
  });

  if (error) {
    console.error(`[email] send failed:`, error);
    throw error;
  }
}