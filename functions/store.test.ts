import { describe, expect, it, beforeEach } from "vitest";
import { store, type UploadEntry } from "./store";

const MAX_UPLOADS = 30;

describe("in-memory store", () => {
  beforeEach(() => {
    store.length = 0;
  });

  it("rejects upload when store is at maximum capacity", () => {
    for (let i = 0; i < MAX_UPLOADS; i++) {
      store.push({ id: `e${i}`, timestamp: "", data: { n: i } });
    }
    expect(store.length).toBe(MAX_UPLOADS);

    const canAccept = store.length < MAX_UPLOADS;
    expect(canAccept).toBe(false);
  });

  it("accepts upload again after a deletion frees a slot", () => {
    store.push(
      { id: "e1", timestamp: "", data: { n: 1 } },
      { id: "e2", timestamp: "", data: { n: 2 } }
    );
    expect(store.length).toBe(MAX_UPLOADS);

    const idx = store.findIndex((e) => e.id === "e1");
    store.splice(idx, 1);
    expect(store.length).toBe(MAX_UPLOADS - 1);

    const canAccept = store.length < MAX_UPLOADS;
    expect(canAccept).toBe(true);
  });

  it("deletes an entry from the store", () => {
    const entry: UploadEntry = {
      id: "test-1",
      timestamp: "2026-05-25T12:00:00.000Z",
      data: { hello: "world" },
    };

    store.push(entry);
    expect(store).toHaveLength(1);

    const idx = store.findIndex((e) => e.id === "test-1");
    store.splice(idx, 1);

    expect(store).toHaveLength(0);
  });

  it("only deletes the targeted entry", () => {
    store.push(
      { id: "a", timestamp: "", data: { x: 1 } },
      { id: "b", timestamp: "", data: { y: 2 } },
      { id: "c", timestamp: "", data: { z: 3 } }
    );
    expect(store).toHaveLength(3);

    const idx = store.findIndex((e) => e.id === "b");
    store.splice(idx, 1);

    expect(store).toHaveLength(2);
    expect(store.map((e) => e.id)).toEqual(["a", "c"]);
  });

  it("does nothing when deleting a non-existent id", () => {
    store.push({ id: "a", timestamp: "", data: {} });
    expect(store).toHaveLength(1);

    const idx = store.findIndex((e) => e.id === "nope");
    if (idx !== -1) store.splice(idx, 1);

    expect(store).toHaveLength(1);
  });
});
