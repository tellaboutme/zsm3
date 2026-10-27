import type { AnnouncementInput } from "@zsm3/contracts/announcements";
import { describe, it } from "vitest";

import { counterRandom, FIXED_CLOCK, memoryDatabase } from "./memory-database.ts";
import { announcementsRepo, type AnnouncementsRepo } from "../../src/storage/announcements-repo.ts";

function repo(): AnnouncementsRepo {
  return announcementsRepo({ db: memoryDatabase(), clock: FIXED_CLOCK, random: counterRandom() });
}

async function add(target: AnnouncementsRepo, item: AnnouncementInput): Promise<string> {
  const write = target.createStatement(item);
  await write.statement.run();
  return write.id;
}

const BASE: AnnouncementInput = {
  severity: "info",
  text: "Dzień otwarty w sobotę.",
  startsOn: "2026-10-20",
  endsOn: "2026-10-25",
};

describe("announcements repository", () => {
  it("stores, reads, updates and deletes an announcement with its link", async ({ expect }) => {
    const target = repo();
    const id = await add(target, { ...BASE, link: { label: "Program", href: "/kandydaci" } });

    expect(await target.get(id)).toEqual({
      id,
      updatedAt: "2026-10-22T08:00:00.000Z",
      ...BASE,
      link: { label: "Program", href: "/kandydaci" },
    });
    await target.updateStatement(id, { ...BASE, text: "Dzień otwarty przełożony." }).run();
    expect(await target.get(id)).toEqual({
      id,
      updatedAt: "2026-10-22T08:00:00.000Z",
      ...BASE,
      text: "Dzień otwarty przełożony.",
    });
    await target.deleteStatement(id).run();
    expect(await target.get(id)).toBeUndefined();
    expect(await target.list()).toEqual([]);
  });

  it("lists the newest first", async ({ expect }) => {
    const target = repo();
    await add(target, BASE);
    await add(target, { ...BASE, startsOn: "2026-11-01", endsOn: "2026-11-02" });

    expect((await target.list()).map((item) => item.startsOn)).toEqual([
      "2026-11-01",
      "2026-10-20",
    ]);
  });

  it("shows one banner on its days, the most severe and newest first", async ({ expect }) => {
    const target = repo();
    await add(target, BASE);
    expect((await target.active("2026-10-19"))?.text).toBeUndefined();
    expect((await target.active("2026-10-20"))?.text).toBe(BASE.text);
    expect((await target.active("2026-10-25"))?.text).toBe(BASE.text);
    expect(await target.active("2026-10-26")).toBeUndefined();

    await add(target, { ...BASE, severity: "important", text: "Ważne." });
    await add(target, { ...BASE, severity: "urgent", text: "Pilne.", startsOn: "2026-10-21" });
    await add(target, {
      ...BASE,
      severity: "urgent",
      text: "Pilne nowsze.",
      startsOn: "2026-10-22",
    });
    expect((await target.active("2026-10-20"))?.text).toBe("Ważne.");
    expect((await target.active("2026-10-21"))?.text).toBe("Pilne.");
    expect((await target.active("2026-10-22"))?.text).toBe("Pilne nowsze.");
  });

  it("refuses an announcement that ends before it starts", ({ expect }) => {
    expect(() =>
      repo().createStatement({ ...BASE, startsOn: "2026-10-25", endsOn: "2026-10-24" }),
    ).toThrow();
  });
});
