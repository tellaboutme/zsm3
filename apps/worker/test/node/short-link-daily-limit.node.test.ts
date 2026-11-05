import { describe, it } from "vitest";

import {
  at,
  attempt,
  CODE,
  DAY,
  deps,
  failSpread,
  failureRows,
  HOUR,
  MINUTE,
  OPEN,
  OTHER,
  RIGHT,
  seed,
  seedFailures,
  START,
  store,
  WRONG,
} from "./short-link-daily-support.ts";
import { passwordRedirect, PASSWORD_ATTEMPTS, unlockLink } from "../../src/short-links/resolve.ts";
import { DAILY_FAILED_ATTEMPTS } from "../../src/storage/short-link-failures-repo.ts";

describe("the rolling daily limit on wrong passwords", () => {
  it("admits the 100th failure and blocks the 101st, even with the right password", async ({
    expect,
  }) => {
    const current = store();
    await seed(current);

    const last = await failSpread(current, DAILY_FAILED_ATTEMPTS - 1, START);
    const hundredth = at(last, 11 * MINUTE);

    expect(DAILY_FAILED_ATTEMPTS).toBe(100);
    await expect(attempt(current, WRONG, hundredth)).resolves.toBe("locked");
    await expect(attempt(current, WRONG, hundredth)).resolves.toBe("blocked");
    await expect(attempt(current, RIGHT, hundredth)).resolves.toBe("blocked");
    await expect(failureRows(current)).resolves.toBe(DAILY_FAILED_ATTEMPTS);
    expect(passwordRedirect({ kind: "blocked" }, "/s/k7mq4ra")).toBe("/s/k7mq4ra?blad=doba");
  });

  it("frees a failure only after it is more than exactly 24 hours old", async ({ expect }) => {
    const current = store();
    await seed(current);
    await seedFailures(current, DAILY_FAILED_ATTEMPTS, START);

    await expect(attempt(current, RIGHT, at(START, DAY - 1))).resolves.toBe("blocked");
    await expect(attempt(current, RIGHT, at(START, DAY))).resolves.toBe("blocked");
    await expect(attempt(current, RIGHT, at(START, DAY + 1))).resolves.toBe("redirect");
  });

  it("allows no second hundred across the edge of an old fixed window", async ({ expect }) => {
    const current = store();
    await seed(current);
    await expect(attempt(current, WRONG, START)).resolves.toBe("locked");
    const lateBurst = at(START, 23 * HOUR);
    await failSpread(current, DAILY_FAILED_ATTEMPTS - 1, lateBurst);

    await expect(attempt(current, WRONG, at(START, DAY))).resolves.toBe("blocked");
    await expect(attempt(current, WRONG, at(START, DAY + 1))).resolves.toBe("locked");
    await expect(attempt(current, WRONG, at(START, DAY + 2))).resolves.toBe("blocked");
    await expect(attempt(current, RIGHT, at(START, DAY + 3))).resolves.toBe("blocked");
    await expect(attempt(current, RIGHT, at(lateBurst, DAY))).resolves.toBe("blocked");
    await expect(attempt(current, RIGHT, at(lateBurst, DAY + 1))).resolves.toBe("redirect");
    await expect(failureRows(current)).resolves.toBe(DAILY_FAILED_ATTEMPTS + 1);
  });

  it("never spends the budget on right passwords or empty submissions", async ({ expect }) => {
    const current = store();
    await seed(current);
    const later = at(await failSpread(current, DAILY_FAILED_ATTEMPTS - 1, START), 11 * MINUTE);

    for (let index = 0; index < 5; index += 1) {
      await expect(attempt(current, RIGHT, later)).resolves.toBe("redirect");
      await expect(unlockLink(deps(current), CODE, undefined, later)).resolves.toEqual({
        kind: "locked",
      });
    }
    await expect(failureRows(current)).resolves.toBe(DAILY_FAILED_ATTEMPTS - 1);
    await expect(attempt(current, WRONG, later)).resolves.toBe("locked");
    await expect(attempt(current, RIGHT, later)).resolves.toBe("blocked");
  });

  it("keeps the budgets of two links apart", async ({ expect }) => {
    const current = store();
    await seed(current);
    const later = at(await failSpread(current, DAILY_FAILED_ATTEMPTS, START), 11 * MINUTE);

    await expect(attempt(current, RIGHT, later)).resolves.toBe("blocked");
    await expect(attempt(current, WRONG, later, OTHER)).resolves.toBe("locked");
    await expect(attempt(current, RIGHT, later, OTHER)).resolves.toBe("redirect");
    await expect(failureRows(current, OTHER)).resolves.toBe(1);
  });

  it("counts a differently written code against the same link", async ({ expect }) => {
    const current = store();
    await seed(current);
    const later = at(await failSpread(current, DAILY_FAILED_ATTEMPTS - 1, START), 11 * MINUTE);

    await expect(attempt(current, WRONG, later, ` ${CODE.toUpperCase()} `)).resolves.toBe("locked");
    await expect(failureRows(current)).resolves.toBe(DAILY_FAILED_ATTEMPTS);
    await expect(attempt(current, RIGHT, later, CODE.toUpperCase())).resolves.toBe("blocked");
  });

  it("leaves the budget alone while the short pause holds", async ({ expect }) => {
    const current = store();
    await seed(current);
    for (let index = 0; index < PASSWORD_ATTEMPTS; index += 1) {
      await attempt(current, WRONG, START);
    }

    await expect(attempt(current, WRONG, START)).resolves.toBe("throttled");
    await expect(failureRows(current)).resolves.toBe(PASSWORD_ATTEMPTS);
  });

  it("never touches the budget for an open link", async ({ expect }) => {
    const current = store();
    await seed(current);

    for (let index = 0; index < DAILY_FAILED_ATTEMPTS + 5; index += 1) {
      await expect(attempt(current, "cokolwiek", START, OPEN)).resolves.toBe("redirect");
    }
    await expect(failureRows(current, OPEN)).resolves.toBe(0);
    const rows = await current.db.prepare("SELECT count(*) AS n FROM rate_limits").first();
    expect(rows).toEqual({ n: 0 });
  });
});
