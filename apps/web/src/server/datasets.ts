import {
  contactsSchema,
  documentsSchema,
  jobOffersSchema,
  meetingsSchema,
  partnersSchema,
  staffDirectorySchema,
  type Contacts,
  type DatasetKey,
  type DocumentGroups,
  type JobOffers,
  type Meetings,
  type Partners,
  type StaffDirectory,
} from "@zsm3/contracts/datasets";
import { programmesSchema, type Programmes } from "@zsm3/contracts/programmes";
import { liveStore } from "@zsm3/worker/storage/database.ts";
import { datasetsRepo } from "@zsm3/worker/storage/datasets-repo.ts";
import { env } from "cloudflare:workers";

async function stored(key: DatasetKey): Promise<unknown> {
  const dataset = await datasetsRepo(liveStore(env.DB)).get(key);
  if (dataset === undefined) {
    throw new Error(`Dataset ${key} is missing; apply the migrations`);
  }
  return dataset.data;
}

export async function staffDirectory(): Promise<StaffDirectory> {
  return staffDirectorySchema.parse(await stored("kadra"));
}

export async function meetings(): Promise<Meetings> {
  return meetingsSchema.parse(await stored("wywiadowki"));
}

export async function contacts(): Promise<Contacts> {
  return contactsSchema.parse(await stored("kontakty"));
}

export async function documentGroups(): Promise<DocumentGroups> {
  return documentsSchema.parse(await stored("dokumenty"));
}

export async function partners(): Promise<Partners> {
  return partnersSchema.parse(await stored("partnerzy"));
}

export async function jobOffers(): Promise<JobOffers> {
  return jobOffersSchema.parse(await stored("oferty-pracy"));
}

export async function programmeData(): Promise<Programmes> {
  return programmesSchema.parse(await stored("kierunki"));
}
