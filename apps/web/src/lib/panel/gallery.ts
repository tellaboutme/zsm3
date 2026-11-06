import { schoolYearSchema } from "@zsm3/contracts/gallery";
import { z } from "zod";

import { CONNECTION_PHRASE, problemPhrase } from "./api.ts";
import { MAX_SOURCE_BYTES } from "./photo-sizing.ts";
import type { PhotoFailure } from "./photo-worker-protocol.ts";

const MB = 1024 * 1024;
const FIRST_LISTED_START = 2013;
const CONNECTION_STATUS = 0;
const SCHOOL_YEAR_START_MONTH = 8;
const LIMIT_MB = 1.5;

const PROBLEM_TITLES: Readonly<Record<string, string>> = {
  "Album Slug Taken":
    "W tym roku szkolnym istnieje już album o takim adresie. Zmień tytuł lub adres.",
  "Album Has No Photos": "Album bez zdjęć nie może zostać opublikowany. Dodaj co najmniej jedno.",
  "Album Is Full": "Album ma już 1000 zdjęć. Utwórz kolejny album.",
  "Publication Status Unchanged": "Stan publikacji już się zmienił. Odśwież stronę.",
  "Photo In Another Album": "To zdjęcie jest już w innym albumie i nie można go dodać drugi raz.",
  "Photo Upload In Progress":
    "To zdjęcie jest właśnie przetwarzane. Spróbuj ponownie za kilka minut.",
  "Invalid Image": "Serwer odrzucił przygotowane zdjęcie. Wybierz inny plik.",
};

const FAILURE_PHRASES: Readonly<Record<PhotoFailure, string>> = {
  unreadable: "Nie udało się odczytać pliku. Wybierz zdjęcie JPG, PNG lub WebP.",
  "too-small": "Zdjęcie jest za małe. Dłuższy bok musi mieć co najmniej 400 pikseli.",
  "too-heavy": `Nie udało się zmieścić zdjęcia w limicie ${String(LIMIT_MB)} MB. Wybierz inny plik.`,
};

const problemTitleSchema = z.looseObject({ title: z.string() });

export function galleryProblemPhrase(status: number, data: unknown): string {
  if (status === 413) {
    return `Przygotowane zdjęcie przekracza limit ${String(LIMIT_MB)} MB.`;
  }
  const parsed = problemTitleSchema.safeParse(data);
  const known = parsed.success ? PROBLEM_TITLES[parsed.data.title] : undefined;
  if (known !== undefined) {
    return known;
  }
  return status === CONNECTION_STATUS ? CONNECTION_PHRASE : problemPhrase(status);
}

export function photoFailurePhrase(failure: PhotoFailure): string {
  return FAILURE_PHRASES[failure];
}

export function sourceFilePhrase(bytes: number): string | undefined {
  if (bytes === 0) {
    return "Plik jest pusty.";
  }
  if (bytes > MAX_SOURCE_BYTES) {
    return `Plik przekracza limit ${String(MAX_SOURCE_BYTES / MB)} MB.`;
  }
  return undefined;
}

export function schoolYearOf(today: Date): string {
  const year = today.getUTCFullYear();
  const start = today.getUTCMonth() + 1 >= SCHOOL_YEAR_START_MONTH ? year : year - 1;
  return `${String(start)}/${String(start + 1)}`;
}

export function schoolYearChoices(today: Date): readonly string[] {
  const first = Number(schoolYearOf(today).slice(0, 4));
  return [...Array(first - FIRST_LISTED_START + 1).keys()].map((index) => {
    const start = first - index;
    return schoolYearSchema.parse(`${String(start)}/${String(start + 1)}`);
  });
}

export function albumStatePhrase(publishedAt: string | null): string {
  return publishedAt === null ? "Szkic" : "Opublikowany";
}

export function removalHidesAlbum(publishedAt: string | null, photoCount: number): boolean {
  return publishedAt !== null && photoCount === 1;
}

export function removePhotoQuestion(alt: string, hidesAlbum: boolean): string {
  const effect = hidesAlbum
    ? "To ostatnie zdjęcie, więc album zniknie ze strony do czasu ponownej publikacji."
    : "Zniknie ze strony od razu.";
  return `Usunąć to zdjęcie z albumu? ${effect}\n\n${alt}`;
}

export function photoRemovedPhrase(hidesAlbum: boolean): string {
  return hidesAlbum ? "Usunięto zdjęcie. Album bez zdjęć został ukryty." : "Usunięto zdjęcie.";
}

export function albumHref(id: string): string {
  return `/panel/galeria/album?id=${encodeURIComponent(id)}`;
}

export function albumIdFrom(search: string): string | undefined {
  const parsed = z.uuid().safeParse(new URLSearchParams(search).get("id"));
  return parsed.success ? parsed.data : undefined;
}

export function uploadPercent(loaded: number, total: number): number {
  return total > 0 ? Math.round((loaded / total) * 100) : 0;
}
