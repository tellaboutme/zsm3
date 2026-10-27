import { it } from "vitest";

import { offerBoard } from "../src/lib/job-offers.ts";

const offer = (
  position: string,
  validUntil: string,
): { employer: string; position: string; validUntil: string } => ({
  employer: "LS Airport Services",
  position,
  validUntil,
});

it("shows valid offers soonest first and moves expired ones to the archive", ({ expect }) => {
  const board = offerBoard(
    [
      offer("Mechanik", "2026-12-31"),
      offer("Stażysta", "2026-10-01"),
      offer("Elektryk", "2026-11-15"),
      offer("Kierowca", "2026-10-26"),
      offer("Magazynier", "2026-09-01"),
    ],
    "2026-10-26",
  );
  expect(board.current.map((item) => item.position)).toEqual(["Kierowca", "Elektryk", "Mechanik"]);
  expect(board.archive.map((item) => item.position)).toEqual(["Stażysta", "Magazynier"]);
});
