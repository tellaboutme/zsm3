export const PREFERENCES_KEY = "zsm3.preferences";

export const preferenceOptions = {
  text: ["125", "150"],
  contrast: ["high"],
  font: ["readable"],
  underline: ["on"],
  grayscale: ["on"],
  motion: ["reduce"],
  theme: ["light", "dark"],
} as const satisfies Readonly<Record<string, readonly string[]>>;

export type PreferenceName = keyof typeof preferenceOptions;

export type Preferences = Readonly<Partial<Record<PreferenceName, string>>>;

export const preferenceNames: readonly PreferenceName[] = [
  "text",
  "contrast",
  "font",
  "underline",
  "grayscale",
  "motion",
  "theme",
];

export function isAllowed(name: PreferenceName, value: unknown): value is string {
  return preferenceOptions[name].some((option) => option === value);
}

function field(source: object, name: PreferenceName): unknown {
  return Object.entries(source).find(([key]) => key === name)?.[1];
}

export function parsePreferences(raw: unknown): Preferences {
  if (typeof raw !== "object" || raw === null) {
    return {};
  }
  const entries = preferenceNames.flatMap((name) => {
    const value = field(raw, name);
    return isAllowed(name, value) ? [[name, value] as const] : [];
  });
  return Object.fromEntries(entries);
}

export function readPreferences(serialized: string | null): Preferences {
  if (serialized === null) {
    return {};
  }
  try {
    return parsePreferences(JSON.parse(serialized));
  } catch {
    return {};
  }
}

export function withPreference(
  preferences: Preferences,
  name: PreferenceName,
  value: string | undefined,
): Preferences {
  const rest = Object.fromEntries(Object.entries(preferences).filter(([key]) => key !== name));
  return isAllowed(name, value) ? { ...rest, [name]: value } : rest;
}

export function rootAttributes(preferences: Preferences): ReadonlyMap<string, string | undefined> {
  return new Map(preferenceNames.map((name) => [`data-${name}`, preferences[name]]));
}

export function scriptLiteral(value: unknown): string {
  return JSON.stringify(value).replace(
    /[<>/\u2028\u2029]/gu,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

export const bootScript = `(function(){try{var o=${scriptLiteral(
  preferenceOptions,
)},p=JSON.parse(localStorage.getItem(${scriptLiteral(
  PREFERENCES_KEY,
)})||"{}"),r=document.documentElement;Object.keys(o).forEach(function(k){if(o[k].indexOf(p[k])>-1){r.setAttribute("data-"+k,p[k])}})}catch(e){}})();`;
