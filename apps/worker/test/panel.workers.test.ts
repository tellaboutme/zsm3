import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeAll, describe, it } from "vitest";

import { cryptoRandom } from "../src/storage/ids.ts";
import { revisionsRepo } from "../src/storage/revisions-repo.ts";
import { staffRepo } from "../src/storage/staff-repo.ts";

const store = { db: env.DB, clock: () => new Date("2026-10-22T08:00:00Z"), random: cryptoRandom };

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

describe("panel storage on D1", () => {
  it("saves and reads staff with the real database", async ({ expect }) => {
    const repo = staffRepo(store);
    await repo.save({ email: "Admin@ZSM3.pl", role: "admin", active: true });
    await repo.save({ email: "admin@zsm3.pl", role: "secretariat", active: false });

    expect(await repo.get("admin@zsm3.pl")).toMatchObject({
      role: "secretariat",
      active: false,
    });
    expect((await repo.list()).map((member) => member.email)).toEqual(["admin@zsm3.pl"]);
  });

  it("appends numbered revisions with the real database", async ({ expect }) => {
    const repo = revisionsRepo(store);
    await repo.append("pages", "/kontakt", '{"v":1}', "admin@zsm3.pl");
    await repo.append("pages", "/kontakt", '{"v":2}', "admin@zsm3.pl");

    expect(await repo.latest("pages", "/kontakt")).toMatchObject({ revision: 2 });
    expect((await repo.list("pages", "/kontakt")).map((item) => item.revision)).toEqual([1, 2]);
  });
});
