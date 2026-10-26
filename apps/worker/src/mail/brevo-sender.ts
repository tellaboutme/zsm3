import { EmailDeliveryError, type EmailSender } from "./email-sender.ts";

type FetchLike = typeof fetch;

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

export function brevoSender(apiKey: string, doFetch: FetchLike = fetch): EmailSender {
  return {
    send: async (message) => {
      let response: Response;
      try {
        response = await doFetch(BREVO_URL, {
          method: "POST",
          headers: {
            accept: "application/json",
            "api-key": apiKey,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            sender: { email: message.from },
            to: [{ email: message.to }],
            subject: message.subject,
            textContent: message.text,
          }),
        });
      } catch (error) {
        throw new EmailDeliveryError("brevo_unreachable", error);
      }
      if (!response.ok) {
        throw new EmailDeliveryError(`brevo_status_${String(response.status)}`);
      }
    },
  };
}
