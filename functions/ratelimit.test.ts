// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { allowUpload, hashIp, MAX_PER_WINDOW, WINDOW_MS } from "./ratelimit";

// Minimal in-memory stand-in for the subset of the D1 API allowUpload uses on
// the rate_limit table: prepare(sql).bind(...).run() / .first().
interface Row {
  ip_hash: string;
  created_at: string;
}

class MockDB {
  rows: Row[] = [];
  prepare(sql: string) {
    return new Stmt(this, sql.trim().replace(/\s+/g, " "));
  }
}

class Stmt {
  private args: unknown[] = [];
  constructor(private db: MockDB, private sql: string) {}
  bind(...args: unknown[]) {
    this.args = args;
    return this;
  }
  async first<T>(): Promise<T> {
    if (this.sql.startsWith("SELECT COUNT(*)")) {
      const [ipHash, windowStart] = this.args as string[];
      const count = this.db.rows.filter(
        (r) => r.ip_hash === ipHash && r.created_at > windowStart
      ).length;
      return { count } as T;
    }
    throw new Error(`Unhandled first(): ${this.sql}`);
  }
  async run() {
    if (this.sql.startsWith("DELETE FROM rate_limit")) {
      const [windowStart] = this.args as string[];
      this.db.rows = this.db.rows.filter((r) => !(r.created_at <= windowStart));
      return { meta: { changes: 0 } };
    }
    if (this.sql.startsWith("INSERT INTO rate_limit")) {
      const [ip_hash, created_at] = this.args as string[];
      this.db.rows.push({ ip_hash, created_at });
      return { meta: { changes: 1 } };
    }
    throw new Error(`Unhandled run(): ${this.sql}`);
  }
}

function mockDb(): D1Database {
  return new MockDB() as unknown as D1Database;
}

describe("hashIp", () => {
  it("produces a stable hex hash that is not the raw IP", async () => {
    const h1 = await hashIp("203.0.113.5");
    const h2 = await hashIp("203.0.113.5");
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(h1).not.toContain("203.0.113.5");
  });

  it("hashes different IPs differently", async () => {
    expect(await hashIp("203.0.113.5")).not.toBe(await hashIp("203.0.113.6"));
  });
});

describe("allowUpload", () => {
  const T0 = Date.UTC(2026, 5, 3, 12, 0, 0);

  it("allows up to the limit, then blocks within the window", async () => {
    const db = mockDb();
    const ip = await hashIp("198.51.100.1");
    for (let i = 0; i < MAX_PER_WINDOW; i++) {
      expect(await allowUpload(db, ip, T0 + i * 1000)).toBe(true);
    }
    expect(await allowUpload(db, ip, T0 + MAX_PER_WINDOW * 1000)).toBe(false);
  });

  it("counts each IP separately", async () => {
    const db = mockDb();
    const a = await hashIp("198.51.100.2");
    const b = await hashIp("198.51.100.3");
    for (let i = 0; i < MAX_PER_WINDOW; i++) await allowUpload(db, a, T0 + i * 1000);
    expect(await allowUpload(db, a, T0 + MAX_PER_WINDOW * 1000)).toBe(false);
    expect(await allowUpload(db, b, T0 + MAX_PER_WINDOW * 1000)).toBe(true);
  });

  it("allows again once the window has passed (old rows pruned)", async () => {
    const db = mockDb();
    const ip = await hashIp("198.51.100.4");
    for (let i = 0; i < MAX_PER_WINDOW; i++) await allowUpload(db, ip, T0 + i * 1000);
    expect(await allowUpload(db, ip, T0 + MAX_PER_WINDOW * 1000)).toBe(false);
    expect(await allowUpload(db, ip, T0 + WINDOW_MS + 1000)).toBe(true);
  });
});
