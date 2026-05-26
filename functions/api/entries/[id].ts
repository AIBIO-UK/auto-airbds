import type { Env } from "../../types";

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const id = context.params.id as string;

  const result = await context.env.DB.prepare(
    "DELETE FROM entries WHERE id = ?"
  )
    .bind(id)
    .run();

  if (result.meta.changes === 0) {
    return new Response("Not found", { status: 404 });
  }

  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
  };

  return new Response(null, { status: 204, headers });
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
};
