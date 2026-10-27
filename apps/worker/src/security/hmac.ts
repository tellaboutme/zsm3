const encoder = new TextEncoder();

export async function hmacSha256(key: string, message: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message)));
}

export async function sha256(message: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(message)));
}
