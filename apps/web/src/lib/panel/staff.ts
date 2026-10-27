import {
  panelStaffMemberSchema,
  panelStaffRoleSchema,
  type PanelStaffMember,
  type PanelStaffRole,
} from "@zsm3/contracts/panel";

export const STAFF_ROLE_LABELS: Readonly<Record<PanelStaffRole, string>> = {
  admin: "administrator",
  secretariat: "sekretariat",
  editor: "redaktor treści",
  gallery_editor: "redaktor galerii",
};

const STAFF_ROLE_HINTS: Readonly<Record<PanelStaffRole, string>> = {
  admin: "wszystko, także pracownicy i przekierowania",
  secretariat: "treści strony, później e-wnioski",
  editor: "treści strony: aktualności, strony, terminarz, dokumenty, ogłoszenia, dzwonki",
  gallery_editor: "galeria zdjęć",
};

export interface StaffRoleOption {
  readonly value: PanelStaffRole;
  readonly label: string;
}

export const STAFF_ROLE_OPTIONS: readonly StaffRoleOption[] = panelStaffRoleSchema.options.map(
  (role) => ({ value: role, label: `${STAFF_ROLE_LABELS[role]} — ${STAFF_ROLE_HINTS[role]}` }),
);

export function staffRoleLabel(role: PanelStaffRole): string {
  return STAFF_ROLE_LABELS[role];
}

export function staffDraft(
  email: string,
  role: string,
  active: boolean,
): PanelStaffMember | undefined {
  const parsed = panelStaffMemberSchema.safeParse({ email, role, active });
  return parsed.success ? parsed.data : undefined;
}

export function isOwnAccount(me: string | undefined, email: string): boolean {
  return me?.trim().toLowerCase() === email;
}

export function staffSummary(total: number, inactive: number): string {
  const active = total - inactive;
  return inactive === 0
    ? `Aktywne konta: ${String(active)}.`
    : `Aktywne konta: ${String(active)}, wyłączone: ${String(inactive)}.`;
}
