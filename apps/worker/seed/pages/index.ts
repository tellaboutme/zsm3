import { contentPageSchema, type ContentPage } from "@zsm3/contracts/content";

import { biblioteka } from "./biblioteka.ts";
import { deklaracjaDostepnosci } from "./deklaracja-dostepnosci.ts";
import { historia } from "./historia.ts";
import { informacje } from "./informacje.ts";
import { kierownictwo } from "./kierownictwo.ts";
import { kolaIKluby } from "./kola-i-kluby.ts";
import { konkursy } from "./konkursy.ts";
import { kursyZawodowe } from "./kursy-zawodowe.ts";
import { materialy } from "./materialy.ts";
import { oSzkole } from "./o-szkole.ts";
import { patron } from "./patron.ts";
import { planyNauczania } from "./plany-nauczania.ts";
import { podreczniki } from "./podreczniki.ts";
import { pomoc } from "./pomoc.ts";
import { projekty } from "./projekty.ts";
import { radaRodzicow } from "./rada-rodzicow.ts";
import { rekrutacja } from "./rekrutacja.ts";
import { rodo } from "./rodo.ts";
import { samorzad } from "./samorzad.ts";
import { skrzynka } from "./skrzynka.ts";
import { standardy } from "./standardy.ts";
import { statut } from "./statut.ts";
import { strefaKursow } from "./strefa-kursow.ts";
import { struktura } from "./struktura.ts";
import { wynajem } from "./wynajem.ts";

export const seedPages: readonly ContentPage[] = [
  oSzkole,
  historia,
  patron,
  statut,
  struktura,
  standardy,
  projekty,
  planyNauczania,
  podreczniki,
  materialy,
  rekrutacja,
  wynajem,
  biblioteka,
  samorzad,
  informacje,
  kierownictwo,
  radaRodzicow,
  strefaKursow,
  pomoc,
  kolaIKluby,
  kursyZawodowe,
  konkursy,
  skrzynka,
  rodo,
  deklaracjaDostepnosci,
].map((page) => contentPageSchema.parse(page));
