import { staffSchema, type StaffInput } from "../src/storage/staff-repo.ts";

export const seedStaff: readonly StaffInput[] = [
  { email: "dev@zsm3.local", role: "admin", active: true },
].map((item) => staffSchema.parse(item));
