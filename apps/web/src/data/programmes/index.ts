import { informatyka } from "./informatyka.ts";
import { logistyka } from "./logistyka.ts";
import { lotnictwo } from "./lotnictwo.ts";
import { mechatronika } from "./mechatronika.ts";
import { motoryzacjaBranzowa } from "./motoryzacja-branzowa.ts";
import { motoryzacjaTechnikum } from "./motoryzacja-technikum.ts";
import type { Programme } from "../../lib/programmes.ts";

export const programmes: readonly Programme[] = [
  ...informatyka,
  ...mechatronika,
  ...motoryzacjaTechnikum,
  ...motoryzacjaBranzowa,
  ...lotnictwo,
  ...logistyka,
];
