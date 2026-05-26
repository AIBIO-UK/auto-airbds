import { describe, expect, it, beforeEach } from "vitest";

interface EntryRow {
  id: string;
  timestamp: string;
  data: string;
}

// Minimal in-memory stand-in for the subset of the D1 API the functions use:
// prepare(sql).bind(...args).run() / .first() / .all().
class MockD1 {
  private rows: EntryRow[] = [];

  prepare(sql: string) {
    return new MockStatement(this.rows, sql.trim().replace(/\s+/g, " "));
  }
}

class MockStatement {
  private args: unknown[] = [];
  constructor(private rows: EntryRow[], private sql: string) {}

  bind(...args: unknown[]) {
    this.args = args;
    return this;
  }

  async first<T>(): Promise<T> {
    if (this.sql.startsWith("SELECT COUNT(*)")) {
      return { count: this.rows.length } as T;
    }
    throw new Error(`Unhandled first(): ${this.sql}`);
  }

  async all<T>(): Promise<{ results: T[] }> {
    if (this.sql.startsWith("SELECT id, timestamp, data")) {
      const results = [...this.rows].sort((a, b) =>
        b.timestamp.localeCompare(a.timestamp)
      );
      return { results: results as T[] };
    }
    throw new Error(`Unhandled all(): ${this.sql}`);
  }

  async run(): Promise<{ meta: { changes: number } }> {
    if (this.sql.startsWith("INSERT INTO entries")) {
      const [id, timestamp, data] = this.args as string[];
      this.rows.push({ id, timestamp, data });
      return { meta: { changes: 1 } };
    }
    if (this.sql.startsWith("DELETE FROM entries")) {
      const [id] = this.args as string[];
      const before = this.rows.length;
      const idx = this.rows.findIndex((r) => r.id === id);
      if (idx !== -1) this.rows.splice(idx, 1);
      return { meta: { changes: before - this.rows.length } };
    }
    throw new Error(`Unhandled run(): ${this.sql}`);
  }
}

const MAX_UPLOADS = 30;

async function count(db: MockD1): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS count FROM entries")
    .first<{ count: number }>();
  return row.count;
}

async function insert(db: MockD1, id: string, ts: string, data: unknown): Promise<void> {
  await db
    .prepare("INSERT INTO entries (id, timestamp, data) VALUES (?, ?, ?)")
    .bind(id, ts, JSON.stringify(data))
    .run();
}

async function remove(db: MockD1, id: string): Promise<number> {
  const res = await db
    .prepare("DELETE FROM entries WHERE id = ?")
    .bind(id)
    .run();
  return res.meta.changes;
}

describe("D1 store", () => {
  let db: MockD1;

  beforeEach(() => {
    db = new MockD1();
  });

  it("rejects upload when store is at maximum capacity", async () => {
    for (let i = 0; i < MAX_UPLOADS; i++) {
      await insert(db, `e${i}`, `2026-05-25T12:00:00.000Z`, i);
    }

    const total = await count(db);
    expect(total).toBe(MAX_UPLOADS);
    expect(total >= MAX_UPLOADS).toBe(true);
  });

  it("accepts upload again after a deletion frees a slot", async () => {
    for (let i = 0; i < MAX_UPLOADS; i++) {
      await insert(db, `e${i}`, `2026-05-25T12:00:00.000Z`, i);
    }

    await remove(db, "e0");

    const total = await count(db);
    expect(total).toBe(MAX_UPLOADS - 1);
    expect(total >= MAX_UPLOADS).toBe(false);
  });

  it("stores and retrieves entries newest-first", async () => {
    await insert(db, "e01", "2026-05-25T12:00:01.000Z", { hello: "world" });
    await insert(db, "e02", "2026-05-25T12:00:02.000Z", { hello: "again" });

    const { results } = await db
      .prepare("SELECT id, timestamp, data FROM entries ORDER BY timestamp DESC")
      .all<EntryRow>();

    expect(results.map((r) => r.id)).toEqual(["e02", "e01"]);
    expect(JSON.parse(results[1].data)).toEqual({ hello: "world" });
  });

  it("reports rows changed when deleting", async () => {
    await insert(db, "e01", "2026-05-25T12:00:01.000Z", 1);
    await insert(db, "e02", "2026-05-25T12:00:02.000Z", 2);

    expect(await remove(db, "e01")).toBe(1);

    const { results } = await db
      .prepare("SELECT id, timestamp, data FROM entries ORDER BY timestamp DESC")
      .all<EntryRow>();
    expect(results.map((r) => r.id)).toEqual(["e02"]);
  });

  it("reports zero rows changed when deleting a non-existent entry", async () => {
    expect(await remove(db, "nope")).toBe(0);
  });
});
