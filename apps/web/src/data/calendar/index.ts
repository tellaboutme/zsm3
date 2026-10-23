import { fileLink } from "@zsm3/worker/seed/files.ts";

import { firstTerm } from "./first-term.ts";
import { secondTerm } from "./second-term.ts";

export const schoolYearEvents = [...firstTerm, ...secondTerm];

export const calendarPdf = fileLink("calendar-2026-27", "Terminarz roku szkolnego").href;
