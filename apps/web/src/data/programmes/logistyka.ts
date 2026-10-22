import type { Programme } from "../../lib/programmes.ts";

export const logistyka: readonly Programme[] = [
  {
    slug: "technik-eksploatacji-portow-i-terminali",
    profession: "technik-eksploatacji-portow-i-terminali",
    school: "technikum",
    lead: "Poznajesz porty lotnicze, kolejowe i morskie oraz terminale transportowe: obsługę podróżnych, organizację transportu, magazynowanie i ładunki.",
    learn: [
      { title: "Obsługa podróżnych", text: "Obsługa pasażerów w portach i terminalach." },
      { title: "Transport", text: "Planowanie i organizowanie pracy różnych środków transportu." },
      { title: "Magazynowanie", text: "Przyjmowanie, składowanie i wydawanie towarów." },
      { title: "Obsługa ładunków", text: "Przeładunek, zabezpieczanie i ewidencja ładunków." },
      { title: "Dokumentacja", text: "Dokumentacja transportowa i magazynowa." },
      { title: "Systemy logistyczne", text: "Systemy informatyczne w pracy portów i terminali." },
    ],
    tools: [],
    practice: [
      "Praktyki w strefach airside i landside portu lotniczego",
      "Płatne staże wakacyjne",
      "Szkolne pracownie zawodowe",
    ],
    exams: [
      {
        code: "SPL.02",
        name: "Obsługa podróżnych",
        scope: "Obsługa podróżnych w portach i terminalach.",
      },
      {
        code: "SPL.03",
        name: "Obsługa ładunków",
        scope: "Obsługa ładunków w portach i terminalach.",
      },
    ],
    careers: [
      { title: "Porty lotnicze", text: "Pasażerowie, bagaż, cargo i procesy w terminalu." },
      { title: "Terminale kolejowe i drogowe", text: "Transport, przeładunek i przepływ towarów." },
      { title: "Porty morskie i rzeczne", text: "Ładunki, magazynowanie i procesy transportowe." },
      { title: "Logistyka i spedycja", text: "Firmy logistyczne, centra magazynowe i spedycja." },
    ],
    erasmus: true,
  },
];
