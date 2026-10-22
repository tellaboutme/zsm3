export interface ClassRoom {
  readonly name: string;
  readonly room: string;
}

export interface GradeRooms {
  readonly grade: string;
  readonly classes: readonly ClassRoom[];
}

export interface MeetingStep {
  readonly time: string;
  readonly text: string;
}

export const meetingPlan = {
  date: "2026-09-09",
  order: "Zarządzenie nr ZSM.3.021/41/26 z 3 września 2026 r.",
  steps: [
    {
      time: "17:00",
      text: "Klasy pierwsze: spotkanie w auli szkolnej z dyrekcją, pedagogiem i psychologiem.",
    },
    { time: "17:30", text: "Spotkania wychowawców z rodzicami w salach klas." },
    { time: "18:15", text: "Szkolna Rada Rodziców z dyrektorem, sala 116." },
  ] satisfies readonly MeetingStep[],
} as const;

export const gradeRooms: readonly GradeRooms[] = [
  {
    grade: "Klasy pierwsze",
    classes: [
      { name: "1 Ta/d", room: "118" },
      { name: "1 Tb", room: "220" },
      { name: "1 Tc/p", room: "026" },
      { name: "1 Ts", room: "226" },
      { name: "1 LST", room: "119" },
      { name: "1 Ba", room: "S11" },
      { name: "1 Bb/d", room: "122" },
    ],
  },
  {
    grade: "Klasy drugie",
    classes: [
      { name: "2 Ta/d", room: "116" },
      { name: "2 Tp", room: "124" },
      { name: "2 Tb", room: "S13" },
      { name: "2 Tc", room: "217" },
      { name: "2 Tm/s", room: "229" },
      { name: "2 Ba", room: "S06" },
    ],
  },
  {
    grade: "Klasy trzecie",
    classes: [
      { name: "3 Ta/d", room: "223" },
      { name: "3 Tb", room: "017" },
      { name: "3 Tm/s", room: "S14a" },
      { name: "3 Tp", room: "121" },
      { name: "3 Ba", room: "123" },
      { name: "3 Bb/d", room: "130" },
    ],
  },
  {
    grade: "Klasy czwarte",
    classes: [
      { name: "4 Ta/m", room: "225" },
      { name: "4 Tb", room: "235" },
      { name: "4 Tc", room: "231" },
      { name: "4 Td", room: "236" },
      { name: "4 Tp", room: "237" },
      { name: "4 Ts", room: "219" },
    ],
  },
  {
    grade: "Klasy piąte",
    classes: [
      { name: "5 Ta", room: "228" },
      { name: "5 Tb", room: "022" },
      { name: "5 Tc", room: "224" },
      { name: "5 Td", room: "S05" },
      { name: "5 Te", room: "117" },
      { name: "5 Tm", room: "S14b" },
      { name: "5 Tp", room: "227" },
      { name: "5 Ts", room: "023" },
    ],
  },
];
