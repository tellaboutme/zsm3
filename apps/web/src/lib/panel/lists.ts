export interface ListPage {
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface Pagination {
  readonly pages: number;
  readonly numbers: readonly number[];
  readonly prev: number | undefined;
  readonly next: number | undefined;
}

const SPAN = 7;

export function totalPages(list: ListPage): number {
  if (list.total <= 0 || list.pageSize <= 0) {
    return 1;
  }
  return Math.ceil(list.total / list.pageSize);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function pagination(list: ListPage): Pagination {
  const pages = totalPages(list);
  const current = clamp(list.page, 1, pages);
  const count = Math.min(SPAN, pages);
  const start = clamp(current - Math.floor(SPAN / 2), 1, pages - count + 1);
  const numbers: number[] = [];
  for (let offset = 0; offset < count; offset += 1) {
    numbers.push(start + offset);
  }
  return {
    pages,
    numbers,
    prev: current > 1 ? current - 1 : undefined,
    next: current < pages ? current + 1 : undefined,
  };
}

export interface ListFilter {
  status: "all" | "draft" | "published";
  page: number;
  year: string;
}

export function listQuery(filter: ListFilter): URLSearchParams {
  const query = new URLSearchParams();
  query.set("page", String(filter.page));
  query.set("pageSize", "20");
  if (filter.status !== "all") {
    query.set("status", filter.status);
  }
  const year = filter.year.trim();
  if (/^\d{4}$/u.test(year)) {
    query.set("year", year);
  }
  return query;
}
