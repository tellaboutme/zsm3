import "../../lib/panel/zod-jitless.ts";
import { panelNewsListSchema } from "@zsm3/contracts/panel";
import { panelRequestsListSchema } from "@zsm3/contracts/panel-requests";
import { panelQuestionsListSchema } from "@zsm3/contracts/questions";

import { area } from "./dom.ts";
import { denyContent, gateView } from "./gate-ui.ts";
import { wireShell } from "./shell.ts";
import { panelSections } from "../../data/panel-sections.ts";
import { panelRead } from "../../lib/panel/api.ts";
import { parse } from "../../lib/panel/models.ts";
import {
  canOpenOverview,
  countLabel,
  tasksFor,
  type OverviewTask,
  type OverviewTaskName,
} from "../../lib/panel/overview.ts";

const UNKNOWN = "—";
const UNKNOWN_NOTE = " (nie udało się pobrać liczby)";

function countOf(task: OverviewTaskName, data: unknown): string | undefined {
  switch (task) {
    case "requests": {
      const list = parse(panelRequestsListSchema, data);
      return list === undefined
        ? undefined
        : countLabel(list.items.length, list.nextBefore !== null);
    }
    case "questions": {
      const list = parse(panelQuestionsListSchema, data);
      return list === undefined
        ? undefined
        : countLabel(list.items.length, list.nextBefore !== null);
    }
    case "drafts": {
      const list = parse(panelNewsListSchema, data);
      return list === undefined ? undefined : countLabel(list.total, false);
    }
  }
}

async function fillTask(item: HTMLElement, task: OverviewTask): Promise<void> {
  const count = area(item, "count");
  const response = await panelRead(task.path);
  const value = response.ok ? countOf(task.task, response.data) : undefined;
  count.textContent = value ?? UNKNOWN;
  area(item, "count-note").textContent = value === undefined ? UNKNOWN_NOTE : "";
}

function showTasks(section: HTMLElement, role: string): void {
  const todo = area(section, "todo");
  const tasks = tasksFor(panelSections, role);
  todo.hidden = tasks.length === 0;
  for (const task of tasks) {
    const item = todo.querySelector<HTMLElement>(`[data-task="${task.task}"]`);
    if (item !== null) {
      item.hidden = false;
      void fillTask(item, task);
    }
  }
}

function boot(section: HTMLElement): void {
  const view = gateView(section);
  wireShell(view, (role) => {
    if (!canOpenOverview(panelSections, role)) {
      denyContent(view);
      return;
    }
    showTasks(section, role);
  });
}

const section = document.querySelector<HTMLElement>('[data-panel-page="overview"]');

if (section !== null) {
  boot(section);
}
