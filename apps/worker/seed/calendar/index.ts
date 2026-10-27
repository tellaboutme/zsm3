import type { SchoolEvent } from "@zsm3/contracts/content";

import { firstTerm } from "./first-term.ts";
import { secondTerm } from "./second-term.ts";

export const seedSchoolYear: readonly SchoolEvent[] = [...firstTerm, ...secondTerm];
