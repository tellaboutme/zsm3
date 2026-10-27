import { datasetKeySchema } from "@zsm3/contracts/datasets";
import { it } from "vitest";

import { counterRandom, FIXED_CLOCK, memoryDatabase } from "./memory-database.ts";
import { seedDatasets } from "../../seed/datasets/index.ts";
import { datasetsRepo } from "../../src/storage/datasets-repo.ts";

it("ships every dataset in the migration exactly as the seed defines it", async ({ expect }) => {
  const repo = datasetsRepo({ db: memoryDatabase(), clock: FIXED_CLOCK, random: counterRandom() });
  for (const [key, data] of Object.entries(seedDatasets)) {
    expect((await repo.get(datasetKeySchema.parse(key)))?.data, key).toEqual(data);
  }
});
