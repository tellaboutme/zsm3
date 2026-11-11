import { describe, it } from "vitest";

import { emailSegments } from "../src/lib/email-breaks.ts";

describe("emailSegments", () => {
  it("breaks after the at sign and before every dot of the domain", ({ expect }) => {
    expect(emailSegments("sekretariat@zespolszkolmechanicznych.edu.pl")).toEqual([
      "sekretariat@",
      "zespolszkolmechanicznych",
      ".edu",
      ".pl",
    ]);
  });

  it("keeps dots in the local part with the name", ({ expect }) => {
    expect(emailSegments("jan.kowalski@zsm3.pl")).toEqual(["jan.kowalski@", "zsm3", ".pl"]);
  });

  it("returns an address without an at sign whole", ({ expect }) => {
    expect(emailSegments("sekretariat")).toEqual(["sekretariat"]);
    expect(emailSegments("")).toEqual([""]);
    expect(emailSegments("@zsm3.pl")).toEqual(["@", "zsm3", ".pl"]);
  });
});
