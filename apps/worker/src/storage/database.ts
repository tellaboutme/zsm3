import type { z } from "zod";

import type { RandomBytes } from "./ids.ts";

export type SqlValue = string | number | null;

export interface SqlStatement {
  bind(...values: SqlValue[]): SqlStatement;
  all(): Promise<{ results: unknown[] }>;
  first(): Promise<unknown>;
  run(): Promise<unknown>;
}

export interface SqlDatabase {
  prepare(query: string): SqlStatement;
  batch(statements: SqlStatement[]): Promise<unknown>;
}

export type Clock = () => Date;

export interface Store {
  readonly db: SqlDatabase;
  readonly clock: Clock;
  readonly random: RandomBytes;
}

export function timestamp(clock: Clock): string {
  return clock().toISOString();
}

export async function allRows<Row>(
  statement: SqlStatement,
  schema: z.ZodType<Row>,
): Promise<readonly Row[]> {
  const { results } = await statement.all();
  return results.map((row) => schema.parse(row));
}

export async function firstRow<Row>(
  statement: SqlStatement,
  schema: z.ZodType<Row>,
): Promise<Row | undefined> {
  const row = await statement.first();
  return row === null ? undefined : schema.parse(row);
}
