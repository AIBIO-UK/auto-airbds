import { describe, expect, it } from "vitest";
import { onRequestDelete } from "./[id]";
import type { Env } from "../../types";

// Minimal context factory. The DELETE handler only touches request, env, and
// params.id, so we stub just those.
function context(env: Partial<Env>, id = "abc") {
  return {
    request: new Request(`https://site/api/entries/${id}`, { method: "DELETE" }),
    env: env as Env,
    params: { id },
    // Unused by the handler.
    functionPath: "",
    waitUntil: () => {},
    passThroughOnException: () => {},
    next: async () => new Response(),
    data: {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function dbReturning(changes: number): Env["DB"] {
  return {
    prepare: () => ({
      bind: () => ({ run: async () => ({ meta: { changes } }) }),
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

// A DB that fails the test if any query is attempted.
const dbForbidden: Env["DB"] = {
  prepare: () => {
    throw new Error("DB must not be queried for an unauthenticated request");
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

describe("DELETE /api/entries/:id auth gate", () => {
  it("returns 401 and does not touch the database when unauthenticated", async () => {
    // No Access JWT and no dev bypass → unauthenticated.
    const res = await onRequestDelete(context({ DB: dbForbidden }));
    expect(res.status).toBe(401);
  });

  it("deletes and returns 204 for an authenticated admin", async () => {
    const res = await onRequestDelete(
      context({ DB: dbReturning(1), ACCESS_DEV_BYPASS: "admin@example.com" })
    );
    expect(res.status).toBe(204);
  });

  it("returns 404 when the authenticated admin deletes a missing entry", async () => {
    const res = await onRequestDelete(
      context({ DB: dbReturning(0), ACCESS_DEV_BYPASS: "admin@example.com" })
    );
    expect(res.status).toBe(404);
  });
});
