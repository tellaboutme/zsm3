import { it } from "vitest";

import { DATASET_FORMS } from "../src/lib/panel/dataset-forms.ts";

it("describes every dataset form exactly as staff see it", ({ expect }) => {
  expect(DATASET_FORMS).toMatchSnapshot();
});
