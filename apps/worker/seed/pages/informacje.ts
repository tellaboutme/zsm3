import type { ContentPage } from "@zsm3/contracts/content";

export const informacje: ContentPage = {
  path: "/rodzice/informacje",
  kicker: "Dla rodziców · ZSM3 Kraków",
  title: "Strefa rodzica",
  intro:
    "Najważniejsze sprawy szkolne w jednym miejscu: wychowawcy klas, spotkania z rodzicami, dokumenty oraz pomoc dla ucznia — bez szukania po całej stronie szkoły.",
  sections: [
    {
      id: "najczesciej-potrzebne",
      title: "Czego potrzebujesz?",
      blocks: [
        {
          type: "callout",
          title: "Wywiadówki i wychowawcy klas",
          text: "Terminy spotkań z rodzicami, numery sal oraz wychowawcy prowadzący spotkanie z klasą.",
          link: { label: "Terminy wywiadówek", href: "/rodzice/wywiadowki" },
        },
        {
          type: "callout",
          title: "Dokumenty",
          text: "Podania, wnioski i formularze najczęściej składane przez rodziców i uczniów.",
          link: { label: "Wzory dokumentów", href: "/uczniowie/wzory-dokumentow" },
        },
        {
          type: "callout",
          title: "Kontakt ze szkołą",
          text: "Sekretariat ZSM3, osiedle Szkolne 37, 31-978 Kraków. Telefon 12 644 06 89.",
          link: { label: "Pełny kontakt", href: "/kontakt" },
        },
      ],
    },
    {
      id: "wsparcie-ucznia",
      title: "Wsparcie ucznia",
      blocks: [
        {
          type: "rich-text",
          document: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Wsparcie dla uczniów i rodziców w sprawach edukacyjnych, wychowawczych i osobistych.",
                },
              ],
            },
            {
              type: "list",
              ordered: false,
              items: [
                [
                  { type: "text", text: "Pedagog szkolny: ", marks: ["bold"] },
                  { type: "text", text: "trudności szkolne i wychowawcze." },
                ],
                [
                  { type: "text", text: "Pedagog specjalny: ", marks: ["bold"] },
                  { type: "text", text: "indywidualne potrzeby edukacyjne." },
                ],
                [
                  { type: "text", text: "Psycholog szkolny: ", marks: ["bold"] },
                  { type: "text", text: "konsultacje i pomoc psychologiczna." },
                ],
              ],
            },
          ],
        },
        {
          type: "callout",
          title: "Pomoc psychologiczno-pedagogiczna",
          text: "Zasady udzielania pomocy, kontakt do specjalistów oraz godziny ich dyżurów.",
          link: { label: "Pomoc w szkole", href: "/szkola/pomoc" },
        },
      ],
    },
    {
      id: "przydatne-miejsca",
      title: "Przydatne miejsca",
      blocks: [
        {
          type: "callout",
          title: "Statut i dokumenty szkoły",
          text: "Statut, regulaminy oraz standardy ochrony małoletnich obowiązujące w szkole.",
          link: { label: "Statut szkoły", href: "/szkola/statut" },
        },
        {
          type: "callout",
          title: "Rada Rodziców",
          text: "Skład, zadania i sposób kontaktu z Radą Rodziców działającą przy szkole.",
          link: { label: "Rada Rodziców", href: "/rodzice/rada-rodzicow" },
        },
        {
          type: "callout",
          title: "Kierownictwo szkoły",
          text: "Dyrekcja, kierownik szkolenia praktycznego oraz administracja i księgowość.",
          link: { label: "Kierownictwo", href: "/rodzice/kierownictwo" },
        },
      ],
    },
  ],
};
