import { staffMember } from "./panel-fixtures.ts";
import { panelHarness, seedStaff, staffClaims, type PanelHarness } from "./panel-support.ts";
import { systemClock } from "../../src/storage/database.ts";
import { cryptoRandom } from "../../src/storage/ids.ts";
import { shortLinkFilesRepo } from "../../src/storage/short-link-files-repo.ts";
import { shortLinksRepo } from "../../src/storage/short-links-repo.ts";

export const ADMIN = "dyrekcja@zsm3.test";
export const TEACHER = "nauczyciel@zsm3.test";
export const LEFT = "byly-nauczyciel@zsm3.test";
export const SECRETARIAT = "sekretariat@zsm3.test";
const TARGET = "https://example.org/materialy";
const FUTURE = "2030-09-01T00:00:00.000Z";

export async function setup(): Promise<PanelHarness> {
  const harness = await panelHarness();
  await seedStaff(harness.env, [
    staffMember(ADMIN, "admin", true),
    staffMember(TEACHER, "editor", true),
    staffMember(SECRETARIAT, "secretariat", true),
    staffMember(LEFT, "editor", false),
  ]);
  const links = shortLinksRepo({ db: harness.env.DB, clock: systemClock, random: cryptoRandom });
  const secret = { salt: new Uint8Array(16), hash: new Uint8Array(32) };
  await links.create({
    code: "k7mq4ra",
    target: TARGET,
    password: secret,
    createdBy: LEFT,
    expiresAt: FUTURE,
  });
  await links.create({
    code: "k7mq4rb",
    target: TARGET,
    password: null,
    createdBy: TEACHER,
    expiresAt: FUTURE,
  });
  await links.create({
    code: "k7mq4rc",
    target: TARGET,
    password: null,
    createdBy: TEACHER,
    expiresAt: FUTURE,
  });
  await links.revoke("k7mq4rc", TEACHER);
  const past = shortLinksRepo({
    db: harness.env.DB,
    clock: () => new Date("2020-01-01T00:00:00.000Z"),
    random: cryptoRandom,
  });
  await past.create({
    code: "k7mq4rd",
    target: TARGET,
    password: null,
    createdBy: LEFT,
    expiresAt: "2020-09-01T00:00:00.000Z",
  });
  const files = shortLinkFilesRepo({
    db: harness.env.DB,
    clock: systemClock,
    random: cryptoRandom,
  });
  const objectKey = "s/0190a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b";
  await files.reserve({ objectKey, name: "Karta.pdf", format: "pdf", bytes: 10, createdBy: LEFT });
  await files.attach({
    code: "k7mq4re",
    objectKey,
    password: null,
    createdBy: LEFT,
    expiresAt: FUTURE,
  });
  return harness;
}

export async function as(harness: PanelHarness, email: string): Promise<string> {
  return harness.keys.sign(staffClaims(email));
}

export async function auditRows(harness: PanelHarness): Promise<unknown[]> {
  const rows = await harness.env.DB.prepare(
    "SELECT actor_email, action, entity, entity_id, details_json FROM audit_log WHERE action = 'short_link.admin_revoke'",
  ).all();
  return rows.results;
}
