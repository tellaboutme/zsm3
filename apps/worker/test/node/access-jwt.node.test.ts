import { CompactSign, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { describe, it } from "vitest";

import type { AccessClock, AccessJwks } from "../../src/security/access-jwt.ts";
import {
  AccessConfigError,
  accessIssuer,
  createAccessVerifier,
  remoteAccessJwks,
} from "../../src/security/access-jwt.ts";

const ISSUER = "https://cloudflareaccess.example";
const AUDIENCE = "acc.tag";
const VERIFIER_CLOCK: AccessClock = () => new Date(1_850_000_000_000);
const VALID_CLAIMS = {
  iss: ISSUER,
  aud: [AUDIENCE],
  email: "dyrektor@zsm3.pl",
  exp: 2_000_000_000,
  iat: 1_800_000_000,
  nbf: 1_850_000_000,
};

interface Fixture {
  readonly jwks: AccessJwks;
  readonly token: string;
}

function without(claims: object, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(claims).filter(([name]) => name !== key));
}

async function fixture(claims: Record<string, unknown>): Promise<Fixture> {
  const { publicKey, privateKey } = await generateKeyPair("ES256", { extractable: true });
  const key = { ...(await exportJWK(publicKey)), kid: "k1", alg: "ES256" };
  const jwks: AccessJwks = createLocalJWKSet({ keys: [key] });
  const token = await new CompactSign(new TextEncoder().encode(JSON.stringify(claims)))
    .setProtectedHeader({ alg: "ES256", kid: "k1" })
    .sign(privateKey);
  return { jwks, token };
}

function verifier(signed: Fixture, audience = AUDIENCE, issuer = ISSUER) {
  return createAccessVerifier({ jwks: signed.jwks, audience, issuer, now: VERIFIER_CLOCK });
}

describe("access verifier", () => {
  it("returns typed claims for a valid token", async ({ expect }) => {
    const signed = await fixture(VALID_CLAIMS);

    expect(await verifier(signed)(signed.token)).toEqual(VALID_CLAIMS);
  });

  it("rejects a token for another audience", async ({ expect }) => {
    const signed = await fixture(VALID_CLAIMS);

    await expect(verifier(signed, "other.tag")(signed.token)).rejects.toThrow();
  });

  it("rejects a token from another issuer", async ({ expect }) => {
    const signed = await fixture(VALID_CLAIMS);

    await expect(
      verifier(signed, AUDIENCE, "https://evil.example")(signed.token),
    ).rejects.toThrow();
  });

  it("rejects an expired token per the injected clock", async ({ expect }) => {
    const signed = await fixture({ ...VALID_CLAIMS, exp: 1_800_000_000 });

    await expect(verifier(signed)(signed.token)).rejects.toThrow();
  });

  it("rejects a token before it becomes valid", async ({ expect }) => {
    const signed = await fixture({ ...VALID_CLAIMS, nbf: 1_900_000_000 });

    await expect(verifier(signed)(signed.token)).rejects.toThrow();
  });

  it("rejects a token without an email claim", async ({ expect }) => {
    const signed = await fixture(without(VALID_CLAIMS, "email"));

    await expect(verifier(signed)(signed.token)).rejects.toThrow();
  });

  it("rejects a tampered signature", async ({ expect }) => {
    const signed = await fixture(VALID_CLAIMS);
    const [head, claimsSegment, signature] = signed.token.split(".");
    if (head === undefined || claimsSegment === undefined || signature === undefined) {
      throw new Error("fixture");
    }
    const flipped = `${signature.startsWith("A") ? "B" : "A"}${signature.slice(1)}`;

    await expect(verifier(signed)(`${head}.${claimsSegment}.${flipped}`)).rejects.toThrow();
  });

  it("prepares the production remote key set without fetching", ({ expect }) => {
    const jwks = remoteAccessJwks("example.cloudflareaccess.com");

    expect(jwks.jwks()).toBeUndefined();
  });

  it("reuses one remote key set per team domain", ({ expect }) => {
    const first = remoteAccessJwks("memo.cloudflareaccess.com");

    expect(remoteAccessJwks("memo.cloudflareaccess.com")).toBe(first);
    expect(remoteAccessJwks("other.cloudflareaccess.com")).not.toBe(first);
  });

  it("builds the issuer from a bare team domain", ({ expect }) => {
    expect(accessIssuer("school.cloudflareaccess.com")).toBe("https://school.cloudflareaccess.com");
  });

  it("keeps an absolute local development origin as its own issuer", ({ expect }) => {
    expect(accessIssuer("http://127.0.0.1:8799")).toBe("http://127.0.0.1:8799");
    expect(accessIssuer("http://localhost:8799")).toBe("http://localhost:8799");
    expect(accessIssuer("http://[::1]:8799")).toBe("http://[::1]:8799");
    expect(accessIssuer("https://school.cloudflareaccess.com")).toBe(
      "https://school.cloudflareaccess.com",
    );
  });

  it("refuses a plain-http issuer outside the loopback interface", ({ expect }) => {
    expect(() => accessIssuer("http://school.cloudflareaccess.com")).toThrow(AccessConfigError);
    expect(() => accessIssuer("http://10.0.0.5:8799")).toThrow(AccessConfigError);
  });
});
