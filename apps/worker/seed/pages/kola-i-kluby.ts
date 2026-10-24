import type { ContentPage } from "@zsm3/contracts/content";

type Block = ContentPage["sections"][number]["blocks"][number];

const paragraph = (value: string): Block => ({
  type: "rich-text",
  document: [{ type: "paragraph", content: [{ type: "text", text: value }] }],
});

export const kolaIKluby: ContentPage = {
  path: "/uczniowie/kola-i-kluby",
  kicker: "Uczniowie · po lekcjach",
  title: "Koła i kluby",
  intro:
    "W szkole działają koła i kluby, w których uczniowie rozwijają zainteresowania poza programem lekcji: od wypraw w góry po rozgrywki e-sportowe.",
  sections: [
    {
      id: "turystyczne",
      title: "Szkolne Koło Turystyczno-Krajoznawcze",
      blocks: [
        {
          type: "facts",
          label: "Koło w liczbach",
          facts: [{ value: "2024", label: "pierwsza wyprawa, marzec" }],
        },
        paragraph(
          "Koło organizuje wyprawy po Małopolsce i południowej Polsce: Tatry Zachodnie i Dolina Chochołowska, Jura Krakowsko-Częstochowska, a także obiekty techniki, jak Kopalnia Guido i Sztolnia Luiza. Z każdej trasy powstaje relacja w kronice koła.",
        ),
      ],
    },
    {
      id: "esport",
      title: "Drużyna e-sportowa",
      blocks: [
        {
          type: "facts",
          label: "Drużyna w liczbach",
          facts: [
            { value: "2018", label: "rok powstania drużyny" },
            { value: "12", label: "zawodników w składzie" },
            { value: "4", label: "turnieje szkół" },
          ],
        },
        paragraph(
          "Drużyna reprezentuje ZSM3 w ogólnopolskich rozgrywkach szkół i organizuje własne turnieje. Liczy się tu strategia, komunikacja w zespole i fair play — a przy okazji wspólna pasja łączy uczniów z różnych klas.",
        ),
      ],
    },
    {
      id: "historyczny",
      title: "Szkolny Klub Historyczny",
      blocks: [
        {
          type: "facts",
          label: "Klub w liczbach",
          facts: [{ value: "2014", label: "działa od września" }],
        },
        paragraph(
          "Klub prowadzi własne projekty historyczne i bierze udział w ogólnopolskich uroczystościach patriotycznych. Dołączyć mogą uczniowie wszystkich klas technikum i szkoły branżowej.",
        ),
      ],
    },
    {
      id: "przedsiebiorczosci",
      title: "Szkolny Klub Przedsiębiorczości nr 539",
      blocks: [
        {
          type: "facts",
          label: "Klub w liczbach",
          facts: [
            { value: "2015", label: "działa od września" },
            { value: "539", label: "numer klubu" },
          ],
        },
        paragraph(
          "Klub realizuje projekty Narodowego Banku Polskiego i Fundacji Młodzieżowej Przedsiębiorczości oraz własne inicjatywy, a uczniowie startują w olimpiadach i konkursach ekonomicznych. Zapraszamy uczniów klas 2–4 technikum oraz 2–3 szkoły branżowej.",
        ),
      ],
    },
    {
      id: "dolacz",
      title: "Jak dołączyć",
      blocks: [
        {
          type: "callout",
          title: "Chcesz dołączyć do koła albo klubu?",
          text: "Zgłoś się do opiekuna koła lub do sekretariatu uczniowskiego — wskażemy właściwą osobę i termin spotkań.",
          link: { label: "Kontakt", href: "/kontakt" },
        },
      ],
    },
  ],
};
