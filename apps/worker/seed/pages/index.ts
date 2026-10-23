import { contentPageSchema, type ContentPage } from "@zsm3/contracts/content";

import { historia } from "./historia.ts";
import { patron } from "./patron.ts";
import { planyNauczania } from "./plany-nauczania.ts";
import { podreczniki } from "./podreczniki.ts";
import { rekrutacja } from "./rekrutacja.ts";
import { standardy } from "./standardy.ts";
import { statut } from "./statut.ts";
import { struktura } from "./struktura.ts";
import { wynajem } from "./wynajem.ts";

export const seedPages: readonly ContentPage[] = [
  historia,
  patron,
  statut,
  struktura,
  standardy,
  planyNauczania,
  podreczniki,
  rekrutacja,
  wynajem,
].map((page) => contentPageSchema.parse(page));
