import { shortLinkExpiry } from "@zsm3/contracts/short-link-expiry";

import { hashPassword } from "../src/security/passwords.ts";
import { objectKeyFor } from "../src/short-links/upload.ts";
import type { Store } from "../src/storage/database.ts";
import { shortLinkFilesRepo } from "../src/storage/short-link-files-repo.ts";
import { shortLinksRepo } from "../src/storage/short-links-repo.ts";

export interface SeedBucket {
  put(key: string, value: Uint8Array): Promise<unknown>;
}

const AUTHOR = "sekretariat@zespolszkolmechanicznych.edu.pl";

export const DEMO_PDF = new TextEncoder().encode(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);

interface FileSeed {
  readonly code: string;
  readonly name: string;
  readonly phrase: string | null;
}

export const FILE_SEEDS: readonly FileSeed[] = [
  { code: "pdfmat3", name: "Karta pracy — przykład.pdf", phrase: null },
  { code: "pdfzhas", name: "Klucz odpowiedzi — przykład.pdf", phrase: "zsm3-demo" },
];

export async function seedShortLinkFiles(
  store: Store,
  bucket: SeedBucket,
  key: string | undefined,
): Promise<number> {
  const links = shortLinksRepo(store);
  const files = shortLinkFilesRepo(store);
  let seeded = 0;
  for (const seed of FILE_SEEDS) {
    if (
      (seed.phrase !== null && key === undefined) ||
      (await links.find(seed.code)) !== undefined
    ) {
      continue;
    }
    const now = store.clock();
    const objectKey = objectKeyFor(now, store.random);
    const bytes = DEMO_PDF.slice();
    await files.reserve({
      objectKey,
      name: seed.name,
      format: "pdf",
      bytes: bytes.byteLength,
      createdBy: AUTHOR,
    });
    await bucket.put(objectKey, bytes);
    await files.attach({
      code: seed.code,
      objectKey,
      password:
        seed.phrase === null || key === undefined
          ? null
          : await hashPassword(key, seed.phrase, store.random),
      createdBy: AUTHOR,
      expiresAt: shortLinkExpiry(now).toISOString(),
    });
    seeded += 1;
  }
  return seeded;
}
