import type { Navigation } from "@zsm3/contracts/navigation";

import type { Announcement } from "./lib/announcement.ts";
import type { BellData } from "./lib/bells.ts";
import type { SchoolEvent } from "./lib/calendar.ts";

declare global {
  namespace App {
    interface Locals {
      announcement?: Announcement;
      bells?: BellData;
      events?: readonly SchoolEvent[];
      navigation?: Navigation;
    }
  }
}

export {};
