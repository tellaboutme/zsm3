import type {
  Contacts,
  DocumentGroups,
  JobOffers,
  Meetings,
  Partners,
  StaffDirectory,
} from "@zsm3/contracts/datasets";
import type { Programmes } from "@zsm3/contracts/programmes";

import { seedContacts } from "./contacts.ts";
import { seedDocuments } from "./documents.ts";
import { seedProgrammes } from "./kierunki/index.ts";
import { seedMeetings } from "./meetings.ts";
import { seedPartners } from "./partners.ts";
import { seedStaffDirectory } from "./staff.ts";

export interface SeedDatasets {
  readonly kadra: StaffDirectory;
  readonly wywiadowki: Meetings;
  readonly kontakty: Contacts;
  readonly dokumenty: DocumentGroups;
  readonly partnerzy: Partners;
  readonly "oferty-pracy": JobOffers;
  readonly kierunki: Programmes;
}

export const seedDatasets: SeedDatasets = {
  kadra: seedStaffDirectory,
  wywiadowki: seedMeetings,
  kontakty: seedContacts,
  dokumenty: seedDocuments,
  partnerzy: seedPartners,
  "oferty-pracy": [],
  kierunki: seedProgrammes,
};
