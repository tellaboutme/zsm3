import { hashPassword } from "../src/security/passwords.ts";
import { timestamp, type Store } from "../src/storage/database.ts";
import { shortLinksRepo } from "../src/storage/short-links-repo.ts";

const DAY_MS = 86_400_000;
const LIFETIME_DAYS = 180;
const AUTHOR = "sekretariat@zespolszkolmechanicznych.edu.pl";

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

export async function seedShortLinks(store: Store, key: string | undefined): Promise<number> {
  const links = shortLinksRepo(store);
  const at = timestamp(store.clock);
  let seeded = 0;
  for (const seed of SEEDS) {
    if (seed.phrase !== null && key === undefined) {
      continue;
    }
    if ((await links.find(seed.code)) !== undefined) {
      continue;
    }
    await links.create({
      code: seed.code,
      target: seed.target,
      password:
        seed.phrase === null || key === undefined
          ? null
          : await hashPassword(key, seed.phrase, store.random),
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
