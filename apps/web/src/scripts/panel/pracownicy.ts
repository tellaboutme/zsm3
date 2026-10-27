import "../../lib/panel/zod-jitless.ts";
import { area, areaForm, areaInput, areaList, areaSelect, button, el, speak } from "./dom.ts";
import { denyContent, gateView } from "./gate-ui.ts";
import { wireShell } from "./shell.ts";
import { panelRead, panelSend, problemPhrase } from "../../lib/panel/api.ts";
import { PANEL_SCHEMAS, parse, type PanelStaffList } from "../../lib/panel/models.ts";
import { staffSave } from "../../lib/panel/mutations.ts";
import {
  isOwnAccount,
  staffDraft,
  STAFF_ROLE_OPTIONS,
  staffSummary,
} from "../../lib/panel/staff.ts";

type StaffRow = PanelStaffList["items"][number];

interface Parts {
  readonly form: HTMLFormElement;
  readonly email: HTMLInputElement;
  readonly role: HTMLSelectElement;
  readonly rows: HTMLUListElement;
  readonly status: HTMLElement;
  me: string | undefined;
}

function partsFor(section: HTMLElement): Parts {
  const form = areaForm(section, "staff-form");
  return {
    form,
    email: areaInput(form, "email"),
    role: areaSelect(form, "role"),
    rows: areaList(section, "staff-rows"),
    status: area(section, "status"),
    me: undefined,
  };
}

function roleSelect(member: StaffRow, locked: boolean): HTMLSelectElement {
  const select = document.createElement("select");
  select.dataset["part"] = "role";
  for (const option of STAFF_ROLE_OPTIONS) {
    const node = document.createElement("option");
    node.value = option.value;
    node.textContent = option.label;
    node.selected = option.value === member.role;
    select.append(node);
  }
  select.disabled = locked;
  return select;
}

function activeBox(member: StaffRow, locked: boolean): HTMLInputElement {
  const box = document.createElement("input");
  box.type = "checkbox";
  box.dataset["part"] = "active";
  box.checked = member.active;
  box.disabled = locked;
  return box;
}

function rowNode(parts: Parts, member: StaffRow): HTMLElement {
  const locked = isOwnAccount(parts.me, member.email);
  const select = roleSelect(member, locked);
  const box = activeBox(member, locked);
  const head = el("p", {
    className: "panel-meta",
    text: locked ? `${member.email} (twoje konto)` : member.email,
  });
  const node = el("li", {
    className: "panel-item",
    children: [
      head,
      el("label", { className: "panel-inline", text: "Rola", children: [select] }),
      el("label", { text: "Konto aktywne ", children: [box] }),
    ],
  });
  if (!locked) {
    const save = button("Zapisz", "panel-staff-save");
    save.setAttribute("aria-label", `Zapisz dostęp ${member.email}`);
    save.addEventListener("click", () => {
      void sendMember(parts, member.email, select.value, box.checked);
    });
    node.append(save);
  }
  return node;
}

async function sendMember(
  parts: Parts,
  email: string,
  role: string,
  active: boolean,
): Promise<boolean> {
  const draft = staffDraft(email, role, active);
  if (draft === undefined) {
    speak(parts.status, ["Podaj pełny adres e-mail, np. imie.nazwisko@zsm3.pl."]);
    return false;
  }
  const response = await panelSend("PUT", "/api/panel/staff", staffSave(draft));
  if (!response.ok) {
    speak(parts.status, [problemPhrase(response.status)]);
    return false;
  }
  speak(parts.status, [`Zapisano dostęp: ${draft.email}.`]);
  await refreshStaff(parts);
  return true;
}

async function refreshStaff(parts: Parts): Promise<void> {
  const response = await panelRead("/api/panel/staff");
  const list = parse(PANEL_SCHEMAS.staffList, response.data);
  if (list === undefined) {
    speak(parts.status, [problemPhrase(response.status)]);
    return;
  }
  parts.rows.replaceChildren(...list.items.map((member) => rowNode(parts, member)));
  const inactive = list.items.filter((member) => !member.active).length;
  speak(parts.status, [staffSummary(list.items.length, inactive)]);
}

export function wirePracownicy(section: HTMLElement): void {
  const parts = partsFor(section);
  parts.form.addEventListener("submit", (event) => {
    event.preventDefault();
    void sendMember(parts, parts.email.value, parts.role.value, true).then((saved) => {
      if (saved) {
        parts.email.value = "";
      }
    });
  });
  const view = gateView(section);
  wireShell(view, (role, me) => {
    if (role !== "admin") {
      denyContent(view);
      return;
    }
    parts.me = me?.email;
    void refreshStaff(parts);
  });
}

const section = document.querySelector<HTMLElement>('[data-panel-page="staff"]');

if (section !== null) {
  wirePracownicy(section);
}
