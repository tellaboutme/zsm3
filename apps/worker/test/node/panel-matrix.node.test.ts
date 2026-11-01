import { beforeAll, describe, it } from "vitest";

import { staffMember } from "./panel-fixtures.ts";
import {
  NEWS,
  OK_STATUS,
  PAGE,
  ROLES,
  rolesByToken,
  routeCases,
  type RoleName,
} from "./panel-matrix-cases.ts";
import { ANNOUNCEMENT, announcementIds, requestIds } from "./panel-matrix-site.ts";
import type { PanelHarness } from "./panel-support.ts";
import { panelHarness, seedStaff, staffClaims } from "./panel-support.ts";
import { routeAllowed } from "../../src/routes/panel/matrix.ts";
import { piiCrypto } from "../../src/security/pii-crypto.ts";
import { announcementsRepo } from "../../src/storage/announcements-repo.ts";
import { systemClock } from "../../src/storage/database.ts";
import { cryptoRandom } from "../../src/storage/ids.ts";
import { newsRepo } from "../../src/storage/news-repo.ts";
import { pagesRepo } from "../../src/storage/pages-repo.ts";
import { redirectsRepo } from "../../src/storage/redirects-repo.ts";
import { requestsRepo } from "../../src/storage/requests-repo.ts";

const PII_KEY = "a".repeat(32);

const REQUEST_PII = JSON.stringify({
  firstName: "Jan",
  lastName: "Kowalski",
  email: "jan.kowalski@zsm3.test",
  statusToken: "a".repeat(43),
});

describe("panel route role matrix", () => {
  let harness: PanelHarness;
  const tokens: Record<RoleName, string> = {
    admin: "",
    secretariat: "",
    editor: "",
    gallery_editor: "",
    none: "",
  };

  beforeAll(async () => {
    harness = await panelHarness();
    await seedStaff(harness.env, [
      staffMember("admin@zsm3.test", "admin", true),
      staffMember("secretariat@zsm3.test", "secretariat", true),
      staffMember("editor@zsm3.test", "editor", true),
      staffMember("gallery_editor@zsm3.test", "gallery_editor", true),
    ]);
    const store = { db: harness.env.DB, clock: systemClock, random: cryptoRandom };
    await newsRepo(store).save(NEWS, "draft");
    await pagesRepo(store).save(PAGE, "published");
    await redirectsRepo(store).save({ from: "/stara", to: "/kontakt" });
    const announcements = announcementsRepo(store);
    const requests = requestsRepo(store);
    const cryptoHelper = piiCrypto({ PRIMARY: PII_KEY }, "PRIMARY", cryptoRandom);
    for (const key of [...ROLES, "shared"] as const) {
      const write = announcements.createStatement(ANNOUNCEMENT);
      await write.statement.run();
      announcementIds.set(key, write.id);
      const requestId = crypto.randomUUID();
      const encrypted = await cryptoHelper.encrypt(REQUEST_PII, requestId);
      await requests.create({
        id: requestId,
        type: "STUDENT_ID_RENEWAL",
        piiCiphertext: encrypted.ciphertext,
        piiKeyId: encrypted.keyId,
        emailIndex: cryptoRandom(32),
        statusTokenHash: cryptoRandom(32),
        formKey: crypto.randomUUID(),
      });
      requestIds.set(key, requestId);
    }
    for (const role of ROLES) {
      const email = role === "none" ? "ghost@zsm3.test" : `${role}@zsm3.test`;
      tokens[role] = await harness.keys.sign(staffClaims(email));
      rolesByToken.set(tokens[role], role);
    }
  });

  it("answers each route per the role matrix", async ({ expect }) => {
    for (const route of routeCases(harness)) {
      for (const role of ROLES) {
        const response = await route.call(tokens[role]);
        const allowed = role !== "none" && routeAllowed(route.name, role);
        expect(response.status, `${route.name}/${role}`).toBe(
          allowed ? OK_STATUS[route.name] : 403,
        );
      }
    }
  });
});
