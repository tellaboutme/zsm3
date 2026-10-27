import type { Programmes } from "@zsm3/contracts/programmes";

import { informatyka } from "./informatyka.ts";
import { logistyka } from "./logistyka.ts";
import { lotnictwo } from "./lotnictwo.ts";
import { mechatronika } from "./mechatronika.ts";
import { motoryzacjaBranzowa } from "./motoryzacja-branzowa.ts";
import { motoryzacjaTechnikum } from "./motoryzacja-technikum.ts";
import { professions } from "./professions.ts";

const programmes: Programmes["programmes"] = [
  ...informatyka,
  ...mechatronika,
  ...motoryzacjaTechnikum,
  ...motoryzacjaBranzowa,
  ...lotnictwo,
  ...logistyka,
];

export const seedProgrammes: Programmes = { professions: [...professions], programmes };
