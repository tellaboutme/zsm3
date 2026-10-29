import {
  hashPassword,
  PASSWORD_SALT_BYTES,
  type PasswordDigest,
} from "../src/security/passwords.ts";
import { timestamp, type Store } from "../src/storage/database.ts";
import { shortLinksRepo } from "../src/storage/short-links-repo.ts";

const DAY_MS = 86_400_000;
const LIFETIME_DAYS = 180;
const AUTHOR = "sekretariat@zespolszkolmechanicznych.edu.pl";
const HASH_BYTES = 32;

interface LinkSeed {
  readonly code: string;
  readonly target: string;
  readonly phrase: string | null;
  readonly revoked: boolean;
}

const SEEDS: readonly LinkSeed[] = [
  {
    code: "materia",
    target: "https://example.org/materialy/plan-lekcji.pdf",
    phrase: null,
    revoked: false,
  },
  {
    code: "zhasqem",
    target: "https://example.org/materialy/karta-pracy.pdf",
    phrase: "zsm3-demo",
    revoked: false,
  },
  {
    code: "wygasny",
    target: "https://example.org/materialy/plan-lekcji.pdf",
    phrase: null,
    revoked: true,
  },
];

async function demoDigest(
  store: Store,
  key: string | undefined,
  phrase: string,
): Promise<PasswordDigest> {
  return key === undefined
    ? { salt: store.random(PASSWORD_SALT_BYTES), hash: store.random(HASH_BYTES) }
    : await hashPassword(key, phrase, store.random);
}

export async function seedShortLinks(store: Store, key: string | undefined): Promise<number> {
  const links = shortLinksRepo(store);
  const at = timestamp(store.clock);
  let seeded = 0;
  for (const seed of SEEDS) {
    if ((await links.find(seed.code)) !== undefined) {
      continue;
    }
    await links.create({
      code: seed.code,
      target: seed.target,
      password: seed.phrase === null ? null : await demoDigest(store, key, seed.phrase),
      createdBy: AUTHOR,
      expiresAt: new Date(Date.parse(at) + LIFETIME_DAYS * DAY_MS).toISOString(),
    });
    if (seed.revoked) {
      await links.revoke(seed.code, AUTHOR, at);
    }
    seeded += 1;
  }
  return seeded;
}
