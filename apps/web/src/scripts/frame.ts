import { initDialogs } from "./dialogs.ts";
import { initMegaMenus } from "./mega-menu.ts";
import { initPreferences } from "./preferences-ui.ts";
import { fallbackBells } from "../data/bell-schedule.ts";
import { DISMISSED_KEY, readDismissed, withDismissed } from "../lib/announcement.ts";
import { readBellData, todaySchedule } from "../lib/bells.ts";
import { isoDay } from "../lib/calendar.ts";
import { describeStatus, liveStatus, warsawClock } from "../lib/live-status.ts";

function initBanners(): void {
  const dismissed = ((): ReadonlySet<string> => {
    try {
      return readDismissed(sessionStorage.getItem(DISMISSED_KEY));
    } catch {
      return new Set();
    }
  })();
  for (const banner of document.querySelectorAll<HTMLElement>("[data-banner]")) {
    const id = banner.dataset["banner"] ?? "";
    banner.hidden = dismissed.has(id);
    banner.querySelector("[data-dismiss-banner]")?.addEventListener("click", () => {
      banner.hidden = true;
      try {
        sessionStorage.setItem(DISMISSED_KEY, withDismissed(dismissed, id));
      } catch {
        return;
      }
    });
  }
}

function initCompactHeader(): void {
  const header = document.querySelector<HTMLElement>("[data-site-header]");
  const sentinel = document.querySelector("[data-scroll-sentinel]");
  if (header === null || sentinel === null) {
    return;
  }
  new IntersectionObserver(([entry]) => {
    header.dataset["compact"] = entry?.isIntersecting === false ? "on" : "off";
  }).observe(sentinel);
}

function initLiveStatus(): void {
  const roots = [...document.querySelectorAll<HTMLElement>("[data-live-status]")];
  if (roots.length === 0) {
    return;
  }
  const bells = readBellData(document.body.dataset["bells"]) ?? fallbackBells;
  const tick = (): void => {
    const now = new Date();
    const today = todaySchedule(bells, isoDay(now));
    const view = describeStatus(liveStatus(today.lessons, warsawClock(now)));
    for (const root of roots) {
      root.dataset["state"] = view.state;
      for (const [field, text] of [
        ["title", view.title],
        ["detail", view.detail],
        ["timer", view.timer],
      ] as const) {
        const target = root.querySelector(`[data-live="${field}"]`);
        if (target !== null) {
          target.textContent = text;
        }
      }
      const bar = root.querySelector("progress");
      if (bar !== null) {
        bar.value = view.progress;
      }
    }
  };
  tick();
  window.setInterval(tick, 1000);
}

initPreferences();
initDialogs();
initMegaMenus();
initBanners();
initCompactHeader();
initLiveStatus();
