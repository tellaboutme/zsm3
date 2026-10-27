import { it } from "vitest";

import { listQuery, pagination, totalPages } from "../src/lib/panel/lists.ts";

const list = { total: 45, page: 2, pageSize: 20 };

it("counts pages from the list totals", ({ expect }) => {
  expect(totalPages(list)).toBe(3);
  expect(totalPages({ total: 0, page: 1, pageSize: 20 })).toBe(1);
  expect(totalPages({ total: 20, page: 1, pageSize: 20 })).toBe(1);
  expect(totalPages({ total: 21, page: 1, pageSize: 20 })).toBe(2);
});

it("shows a contiguous page window with prev and next", ({ expect }) => {
  expect(pagination(list)).toEqual({
    pages: 3,
    numbers: [1, 2, 3],
    prev: 1,
    next: 3,
  });
});

it("clamps a page that exceeds the list", ({ expect }) => {
  const beyond = pagination({ total: 5, page: 9, pageSize: 20 });
  expect(beyond.numbers).toEqual([1]);
  expect(beyond.prev).toBeUndefined();
  expect(beyond.next).toBeUndefined();
});

it("stabilizes the window at the edges", ({ expect }) => {
  const wide = { total: 500, page: 1, pageSize: 20 };
  expect(pagination(wide).numbers).toEqual([1, 2, 3, 4, 5, 6, 7]);
  expect(pagination({ total: 500, page: 25, pageSize: 20 }).numbers).toEqual([
    19, 20, 21, 22, 23, 24, 25,
  ]);
});

it("builds the list query from the filter", ({ expect }) => {
  expect(listQuery({ status: "all", page: 1, year: "" }).toString()).toBe("page=1&pageSize=20");
  expect(listQuery({ status: "draft", page: 3, year: "2026" }).get("status")).toBe("draft");
  expect(listQuery({ status: "published", page: 3, year: " " }).get("year")).toBeNull();
  expect(listQuery({ status: "published", page: 3, year: "20" }).get("year")).toBeNull();
});
