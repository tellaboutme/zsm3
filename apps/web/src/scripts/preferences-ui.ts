import {
  PREFERENCES_KEY,
  preferenceNames,
  readPreferences,
  rootAttributes,
  withPreference,
  type PreferenceName,
  type Preferences,
} from "../lib/preferences.ts";
import { nextTheme, themeLabel } from "../lib/theme.ts";

function load(): Preferences {
  try {
    return readPreferences(localStorage.getItem(PREFERENCES_KEY));
  } catch {
    return {};
  }
}

function save(preferences: Preferences): void {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    return;
  }
}

function apply(preferences: Preferences): void {
  const root = document.documentElement;
  for (const [attribute, value] of rootAttributes(preferences)) {
    if (value === undefined) {
      root.removeAttribute(attribute);
    } else {
      root.setAttribute(attribute, value);
    }
  }
  for (const label of document.querySelectorAll("[data-theme-label]")) {
    label.textContent = themeLabel(preferences.theme);
  }
}

function syncForm(form: HTMLFormElement, preferences: Preferences): void {
  for (const input of form.querySelectorAll("input")) {
    const name = preferenceNames.find((known) => known === input.name);
    if (name !== undefined) {
      input.checked = (preferences[name] ?? "") === input.value;
    }
  }
}

function valueOf(input: HTMLInputElement): string | undefined {
  const chosen = input.type === "checkbox" ? input.checked : input.value !== "";
  return chosen ? input.value : undefined;
}

export function initPreferences(): void {
  let preferences = load();
  const form = document.querySelector<HTMLFormElement>("[data-settings-form]");
  const update = (name: PreferenceName, value: string | undefined): void => {
    preferences = withPreference(preferences, name, value);
    save(preferences);
    apply(preferences);
    if (form !== null) {
      syncForm(form, preferences);
    }
  };
  apply(preferences);

  if (form !== null) {
    syncForm(form, preferences);
    form.addEventListener("change", (event) => {
      const input = event.target;
      const name = preferenceNames.find(
        (known) => input instanceof HTMLInputElement && known === input.name,
      );
      if (name !== undefined && input instanceof HTMLInputElement) {
        update(name, valueOf(input));
      }
    });
    form.querySelector("[data-reset-settings]")?.addEventListener("click", () => {
      preferences = {};
      save(preferences);
      apply(preferences);
      syncForm(form, preferences);
    });
  }
  for (const toggle of document.querySelectorAll("[data-theme-toggle]")) {
    toggle.addEventListener("click", () => {
      update("theme", nextTheme(preferences.theme));
    });
  }
}
