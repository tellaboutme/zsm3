import { newsSaveMutation, sampleNews, staffMember } from "./panel-fixtures.ts";
import {
  panelHarness,
  panelJsonCall,
  seedStaff,
  staffClaims,
  type PanelHarness,
} from "./panel-support.ts";
import type { IndexNowEndpoint } from "../../src/services/indexnow.ts";

export const INDEXNOW_EDITOR = staffMember("redakcja@zsm3.test", "editor", true);

export const SALON = sampleNews("salon-maturzystow", "Salon Maturzystow");

export const SALON_API_PATH = "/news/2026/salon-maturzystow";

export interface RecordedEndpoint {
  readonly endpoint: IndexNowEndpoint;
  readonly pegs: string[][];
}

export function recordingEndpoint(): RecordedEndpoint {
  const pegs: string[][] = [];
  return {
    pegs,
    endpoint: {
      submit: async (urls) => {
        pegs.push([...urls]);
        return Promise.resolve(true);
      },
    },
  };
}

export interface IndexNowSession {
  readonly harness: PanelHarness;
  readonly token: string;
  readonly pegs: string[][];
}

export async function indexNowSession(
  endpoint: RecordedEndpoint = recordingEndpoint(),
): Promise<IndexNowSession> {
  const harness = await panelHarness({ indexnow: endpoint.endpoint });
  await seedStaff(harness.env, [INDEXNOW_EDITOR]);
  const token = await harness.keys.sign(staffClaims(INDEXNOW_EDITOR.email));
  return { harness, token, pegs: endpoint.pegs };
}

export async function publishedSalon(session: IndexNowSession): Promise<void> {
  const { harness, token, pegs } = session;
  const created = await panelJsonCall(harness, "POST", "/news", {
    token,
    body: newsSaveMutation(SALON),
  });
  const published = await panelJsonCall(harness, "PATCH", SALON_API_PATH, {
    token,
    body: { entity: "news", mutation: { action: "publish" } },
  });
  if (created.status !== 201 || published.status !== 200 || pegs.length !== 1) {
    throw new Error("the published article fixture could not be prepared");
  }
  pegs.length = 0;
}
