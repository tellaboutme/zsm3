const order = [undefined, "light", "dark"] as const;

export function nextTheme(current: string | undefined): string | undefined {
  const index = order.findIndex((theme) => theme === current);
  return order[(index + 1) % order.length];
}

export function themeLabel(current: string | undefined): string {
  switch (current) {
    case "light":
      return "Motyw: jasny";
    case "dark":
      return "Motyw: ciemny";
    case undefined:
    default:
      return "Motyw: systemowy";
  }
}
