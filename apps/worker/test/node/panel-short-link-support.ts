import { staffMember } from "./panel-fixtures.ts";
import {
  PANEL_ORIGIN,
  panelHarness,
  panelUrl,
  seedStaff,
  staffClaims,
  type PanelHarness,
} from "./panel-support.ts";

export const OWNER = "editor@zsm3.test";
export const OTHER = "sekretariat@zsm3.test";
export const GALLERY = "galeria@zsm3.test";
export const KEY = "short-link-pepper-0123456789-0123456789";

export async function harness(withKey = true): Promise<PanelHarness> {
  const base = await panelHarness();
  await seedStaff(base.env, [
    staffMember(OWNER, "editor", true),
    staffMember(OTHER, "secretariat", true),
    staffMember(GALLERY, "gallery_editor", true),
  ]);
  return { ...base, env: { ...base.env, SHORT_LINK_KEY: withKey ? KEY : undefined } };
}

export async function token(h: PanelHarness, email: string = OWNER): Promise<string> {
  return h.keys.sign(staffClaims(email));
}

export function uploadRequest(
  bearer: string,
  file: File | string,
  fields: Readonly<Record<string, string>> = {},
): Request {
  const form = new FormData();
  form.set("file", file);
  for (const [name, value] of Object.entries(fields)) {
    form.set(name, value);
  }
  return new Request(panelUrl("/short-links/files"), {
    method: "POST",
    headers: { authorization: `Bearer ${bearer}`, origin: PANEL_ORIGIN },
    body: form,
  });
}
