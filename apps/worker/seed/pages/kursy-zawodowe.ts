import type { ContentPage } from "@zsm3/contracts/content";

type Block = ContentPage["sections"][number]["blocks"][number];

const paragraph = (value: string): Block => ({
  type: "rich-text",
  document: [{ type: "paragraph", content: [{ type: "text", text: value }] }],
});

export const kursyZawodowe: ContentPage = {
  path: "/kandydaci/kursy-zawodowe",
  kicker: "Kandydaci · kwalifikacyjne kursy zawodowe",
  title: "Kursy zawodowe",
  intro:
    "Kwalifikacyjne kursy zawodowe pozwalają zdobyć konkretną kwalifikację bez powrotu do szkoły dziennej. ZSM3 prowadzi kursy w trzech obszarach: informatycznym, samochodowym i mechatronicznym.",
  sections: [
    {
      id: "informatyka",
      title: "Montaż i eksploatacja komputerów osobistych oraz urządzeń peryferyjnych",
      blocks: [
        {
          type: "facts",
          label: "Kurs w skrócie",
          facts: [
            { value: "INF.02", label: "kwalifikacja w zawodzie technik informatyk" },
            { value: "Sprzęt i systemy", label: "obszar kształcenia" },
          ],
        },
        paragraph(
          "Kurs obejmuje dobór podzespołów i montaż komputerów, przygotowanie systemów operacyjnych i oprogramowania narzędziowego, konfigurację urządzeń peryferyjnych, konserwację sprzętu, diagnostykę i usuwanie usterek, monitorowanie pracy systemów oraz wycenę konfiguracji i napraw. Uczy też organizacji bezpiecznego stanowiska pracy i postępowania ze zużytym sprzętem.",
        ),
      ],
    },
    {
      id: "motoryzacja",
      title: "Diagnozowanie i naprawa elektrycznych i elektronicznych układów pojazdów",
      blocks: [
        {
          type: "facts",
          label: "Kurs w skrócie",
          facts: [
            { value: "MOT.02", label: "kwalifikacja w zawodzie technik pojazdów samochodowych" },
            { value: "Diagnostyka", label: "obszar kształcenia" },
          ],
        },
        paragraph(
          "Kurs przygotowuje do diagnostyki samochodowej: pracy z instalacjami elektrycznymi i elektroniką pojazdów, lokalizowania i usuwania usterek oraz kontroli ponaprawczej.",
        ),
      ],
    },
    {
      id: "mechatronika",
      title: "Montaż urządzeń i systemów mechatronicznych",
      blocks: [
        {
          type: "facts",
          label: "Kurs w skrócie",
          facts: [
            { value: "ELM.03", label: "kwalifikacja w zawodzie technik mechatronik" },
            { value: "Montaż", label: "obszar kształcenia" },
          ],
        },
        paragraph(
          "Kurs łączy mechanikę, pneumatykę, hydraulikę, elektrykę i elektronikę w działających systemach mechatronicznych: od montażu podzespołów po uruchomienie całego układu.",
        ),
      ],
    },
    {
      id: "zapisy",
      title: "Jak się zapisać",
      blocks: [
        {
          type: "callout",
          title: "Zapytaj o najbliższy termin",
          text: "O organizacji kształcenia, terminach i wymaganych dokumentach informuje sekretariat szkoły.",
          link: { label: "Kontakt", href: "/kontakt" },
        },
      ],
    },
  ],
};
