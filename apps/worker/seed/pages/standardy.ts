import type { ContentPage } from "@zsm3/contracts/content";

import { fileLink } from "../files.ts";

const annexes = [
  "Zasady rekrutacji personelu",
  "Charakterystyczne symptomy krzywdzenia małoletniego",
  "Relacje personel – uczeń",
  "Relacje uczeń – uczeń",
  "Karta interwencji",
  "Zasady ochrony wizerunku i danych osobowych",
  "Zasady bezpiecznego korzystania z internetu",
  "Ankieta",
  "Oświadczenie pracownika",
];

export const standardy: ContentPage = {
  path: "/szkola/standardy-ochrony-maloletnich",
  kicker: "Szkoła · bezpieczeństwo",
  title: "Standardy ochrony małoletnich",
  intro:
    "Zasady ochrony uczniów przed krzywdzeniem, bezpiecznych relacji w szkole oraz procedury postępowania obowiązujące w Zespole Szkół Mechanicznych nr 3.",
  sections: [
    {
      id: "standardy",
      title: "Standardy",
      blocks: [
        {
          type: "files",
          label: "Dokument główny",
          files: [
            fileLink("protection-main", "Standardy ochrony małoletnich w ZSM nr 3"),
            fileLink(
              "protection-short",
              "Standardy ochrony małoletnich – wersja dla uczniów",
              "Skrócona wersja napisana dla uczniów.",
            ),
          ],
        },
      ],
    },
    {
      id: "zalaczniki",
      title: "Załączniki i formularze",
      blocks: [
        {
          type: "files",
          label: "Załączniki do standardów",
          files: annexes.map((title, index) =>
            fileLink(
              `protection-annex-${String(index + 1)}`,
              `Załącznik ${String(index + 1)}: ${title}`,
            ),
          ),
        },
        {
          type: "files",
          label: "Formularz i komplet",
          files: [
            fileLink(
              "protection-blue-card",
              "Niebieska Karta – A",
              "Formularz wszczęcia procedury.",
            ),
            fileLink(
              "protection-all",
              "Komplet dokumentów",
              "Standardy, wersja dla uczniów, załączniki i formularz w jednym archiwum.",
            ),
          ],
        },
      ],
    },
  ],
};
