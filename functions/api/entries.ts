import type { Env, EntryRow, UploadEntry } from "../types";

export const onRequest: PagesFunction<Env> = async (context) => {
  const { results } = await context.env.DB.prepare(
    "SELECT id, timestamp, data FROM entries ORDER BY timestamp DESC"
  ).all<EntryRow>();

  const entries: UploadEntry[] = results.map((row) => ({
    id: row.id,
    timestamp: row.timestamp,
    data: JSON.parse(row.data),
  }));

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  return new Response(JSON.stringify(entries), {
    status: 200,
    headers,
  });
};
