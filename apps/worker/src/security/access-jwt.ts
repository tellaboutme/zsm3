import { createRemoteJWKSet, jwtVerify, type LocalJWKSet, type RemoteJWKSet } from "jose";

import { accessClaimsSchema, type AccessClaims } from "./access-claims.ts";

export type AccessJwks = RemoteJWKSet | LocalJWKSet;

export type AccessClock = () => Date;

export interface AccessVerifierOptions {
  readonly jwks: AccessJwks;
  readonly audience: string;
  readonly issuer: string;
  readonly now: AccessClock;
}

export type AccessVerifier = (token: string) => Promise<AccessClaims>;

export class AccessConfigError extends Error {
  constructor() {
    super("Panel access environment configuration is missing");
    this.name = "AccessConfigError";
  }
}

const DEFAULT_JWKS_PATH = "/cdn-cgi/access/certs";

const jwksByDomain = new Map<string, AccessJwks>();

const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(["127.0.0.1", "localhost", "[::1]"]);

export function accessIssuer(teamDomain: string): string {
  if (teamDomain.startsWith("https://")) {
    return teamDomain;
  }
  if (teamDomain.startsWith("http://")) {
    if (!LOOPBACK_HOSTS.has(new URL(teamDomain).hostname)) {
      throw new AccessConfigError();
    }
    return teamDomain;
  }
  return `https://${teamDomain}`;
}

export function remoteAccessJwks(teamDomain: string, path = DEFAULT_JWKS_PATH): AccessJwks {
  const cacheKey = `${teamDomain}${path}`;
  const cached = jwksByDomain.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }
  const created = createRemoteJWKSet(new URL(`${accessIssuer(teamDomain)}${path}`));
  jwksByDomain.set(cacheKey, created);
  return created;
}

export function createAccessVerifier(options: AccessVerifierOptions): AccessVerifier {
  return async (token) => {
    const { payload } = await jwtVerify(token, options.jwks, {
      audience: options.audience,
      issuer: options.issuer,
      currentDate: options.now(),
    });
    return accessClaimsSchema.parse(payload);
  };
}
