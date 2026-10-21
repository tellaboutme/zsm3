import { createApp } from "../src/app.ts";

export const ORIGIN = "https://zsm3.test";

export async function send(path: string, init?: RequestInit): Promise<Response> {
  return createApp().request(`${ORIGIN}${path}`, init);
}
