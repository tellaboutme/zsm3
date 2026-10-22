export interface Phone {
  readonly number: string;
  readonly label: string;
}

export interface ContactCard {
  readonly title: string;
  readonly role: string;
  readonly phones: readonly Phone[];
  readonly emails: readonly string[];
}

const office = (extension: string): Phone => ({
  number: `+48126440689,${extension}`,
  label: `12 644 06 89 wew. ${extension}`,
});

const leadership = (extension: string): Phone => ({
  number: `+48126442437,${extension}`,
  label: `12 644 24 37 wew. ${extension}`,
});

export const departments: readonly ContactCard[] = [
  {
    title: "Sekretariat główny",
    role: "Sprawy ogólne",
    phones: [office("104")],
    emails: ["s@zespolszkolmechanicznych.edu.pl", "zsm3@mjo.krakow.pl"],
  },
  {
    title: "Sekretariat uczniowski",
    role: "Dla uczniów",
    phones: [office("103")],
    emails: ["u@zespolszkolmechanicznych.edu.pl"],
  },
  {
    title: "Księgowość",
    role: "Finanse",
    phones: [office("102")],
    emails: ["k@zespolszkolmechanicznych.edu.pl"],
  },
  {
    title: "Rada Rodziców",
    role: "Rodzice",
    phones: [],
    emails: ["rodzice.zsm3@wp.pl"],
  },
];

export const management: readonly ContactCard[] = [
  { title: "Dyrektor szkoły", role: "Kierownictwo", phones: [leadership("12")], emails: [] },
  {
    title: "Wicedyrektor",
    role: "Kierownictwo",
    phones: [leadership("26")],
    emails: ["vice.zsm3@gmail.com"],
  },
  {
    title: "Kierownik szkolenia praktycznego",
    role: "Kształcenie praktyczne",
    phones: [leadership("22")],
    emails: ["ksp.zsm3@gmail.com"],
  },
  {
    title: "Kierownik administracji",
    role: "Administracja",
    phones: [office("101")],
    emails: ["admin@zespolszkolmechanicznych.edu.pl"],
  },
  {
    title: "Inspektor ochrony danych",
    role: "Sprawy RODO",
    phones: [],
    emails: ["inspektor4@mjo.krakow.pl"],
  },
];
