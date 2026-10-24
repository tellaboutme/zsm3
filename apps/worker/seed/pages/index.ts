import { contentPageSchema, type ContentPage } from "@zsm3/contracts/content";

import { biblioteka } from "./biblioteka.ts";
import { historia } from "./historia.ts";
import { kolaIKluby } from "./kola-i-kluby.ts";
import { kursyZawodowe } from "./kursy-zawodowe.ts";
import { patron } from "./patron.ts";
import { planyNauczania } from "./plany-nauczania.ts";
import { podreczniki } from "./podreczniki.ts";
import { pomoc } from "./pomoc.ts";
import { radaRodzicow } from "./rada-rodzicow.ts";
import { rekrutacja } from "./rekrutacja.ts";
import { samorzad } from "./samorzad.ts";
import { standardy } from "./standardy.ts";
import { statut } from "./statut.ts";
import { strefaKursow } from "./strefa-kursow.ts";
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
  biblioteka,
  samorzad,
  radaRodzicow,
  strefaKursow,
  pomoc,
  kolaIKluby,
  kursyZawodowe,
].map((page) => contentPageSchema.parse(page));
