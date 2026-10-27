import { PASSWORD_SALT_BYTES } from "../src/security/passwords.ts";
import { timestamp, type Store } from "../src/storage/database.ts";
import { shortLinksRepo } from "../src/storage/short-links-repo.ts";

const DAY_MS = 86_400_000;
const LIFETIME_DAYS = 180;
const AUTHOR = "sekretariat@zespolszkolmechanicznych.edu.pl";
const HASH_BYTES = 32;

interface LinkSeed {
  readonly code: string;
  readonly target: string;
  readonly locked: boolean;
  readonly revoked: boolean;
}

const SEEDS: readonly LinkSeed[] = [
  {
    code: "materia",
    target: "https://example.org/materialy/plan-lekcji.pdf",
    locked: false,
    revoked: false,
  },
  {
    code: "zhasqem",
    target: "https://example.org/materialy/karta-pracy.pdf",
    locked: true,
    revoked: false,
  },
  {
    code: "wygasny",
    target: "https://example.org/materialy/plan-lekcji.pdf",
    locked: false,
    revoked: true,
  },
];

export async function seedShortLinks(store: Store): Promise<number> {
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
      password: seed.locked
        ? { salt: store.random(PASSWORD_SALT_BYTES), hash: store.random(HASH_BYTES) }
        : null,
      createdBy: AUTHOR,
      expiresAt: new Date(Date.parse(at) + LIFETIME_DAYS * DAY_MS).toISOString(),
    });
    if (seed.revoked) {
      await links.revoke(seed.code, at);
    }
    seeded += 1;
  }
  return seeded;
}
