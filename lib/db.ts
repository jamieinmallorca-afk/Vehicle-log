import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import fs from "node:fs";
import path from "node:path";

const g = globalThis as unknown as { __pool?: Pool; __ready?: Promise<void> };

function makePool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const ssl = process.env.PGSSL === "true" || /rlwy\.net/.test(url) ? { rejectUnauthorized: false } : undefined;
  return new Pool({ connectionString: url, ssl, max: 5 });
}

function pool(): Pool {
  return (g.__pool ??= makePool());
}

async function ensureSchema(): Promise<void> {
  g.__ready ??= (async () => {
    const sql = fs.readFileSync(path.join(process.cwd(), "schema.sql"), "utf8");
    await pool().query(sql);
  })().catch((e) => {
    g.__ready = undefined; // retry on next request
    throw e;
  });
  return g.__ready;
}

export async function query<T extends QueryResultRow = any>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
  await ensureSchema();
  return pool().query<T>(text, params);
}

export async function withTransaction<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  await ensureSchema();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export type EntryRow = {
  id: number;
  created_by: string;
  created_at: Date;
  occurred_at: Date;
  location_text: string;
  lat: number | null;
  lng: number | null;
  vehicle: string;
  notes: string;
  recheck_due_at: Date;
  recheck_done_at: Date | null;
  follow_up_of: number | null;
};

export const RECHECK_DAYS = Math.max(1, parseInt(process.env.RECHECK_DAYS || "10", 10) || 10);
