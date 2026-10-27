import { describe, it, vi } from "vitest";
import { z } from "zod";

import { brevoSender } from "../../src/mail/brevo-sender.ts";
import { EmailDeliveryError } from "../../src/mail/email-sender.ts";

const message = {
  from: "no-reply@zespolszkolmechanicznych.edu.pl",
  to: "jan@example.com",
  subject: "Temat",
  text: "Treść",
};

describe("brevoSender", () => {
  it("preserves a delivery error's code and cause", ({ expect }) => {
    const cause = new TypeError("network failure");
    const error = new EmailDeliveryError("brevo_unreachable", cause);
    expect(error.name).toBe("EmailDeliveryError");
    expect(error.errorCode).toBe("brevo_unreachable");
    expect(error.cause).toBe(cause);
  });
  it("posts a json payload with the api key", async ({ expect }) => {
    const doFetch = vi.fn(async (...args: Parameters<typeof fetch>) => {
      expect(args).toHaveLength(2);
      return Promise.resolve(new Response("{}", { status: 200 }));
    });
    const sender = brevoSender("brevo-key", doFetch);

    await expect(sender.send(message)).resolves.toBeUndefined();
    expect(doFetch).toHaveBeenCalledTimes(1);
    expect(doFetch.mock.calls[0]?.[0]).toBe("https://api.brevo.com/v3/smtp/email");
    expect(doFetch.mock.calls[0]?.[1]?.method).toBe("POST");
    expect(doFetch.mock.calls[0]?.[1]?.headers).toMatchObject({
      "api-key": "brevo-key",
      accept: "application/json",
      "content-type": "application/json",
    });
    const payload = z
      .unknown()
      .parse(JSON.parse(z.string().parse(doFetch.mock.calls[0]?.[1]?.body)));
    expect(payload).toEqual({
      sender: { email: message.from },
      to: [{ email: message.to }],
      subject: message.subject,
      textContent: message.text,
    });
  });

  it("maps a http error to a delivery error with the status", async ({ expect }) => {
    const sender = brevoSender(
      "brevo-key",
      vi.fn(async () => Promise.resolve(new Response("no", { status: 401 }))),
    );

    await expect(sender.send(message)).rejects.toThrow(EmailDeliveryError);
    await expect(sender.send(message)).rejects.toThrow("brevo_status_401");
  });

  it("maps a network failure to a delivery error", async ({ expect }) => {
    const sender = brevoSender(
      "brevo-key",
      vi.fn(async () => Promise.reject(new TypeError("network down"))),
    );

    await expect(sender.send(message)).rejects.toThrow("brevo_unreachable");
  });
});
