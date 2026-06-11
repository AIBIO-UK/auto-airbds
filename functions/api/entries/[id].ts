import type { Env } from "../../types";
import { getAdmin } from "../../auth";

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  // Deleting an upload is an admin-only action, gated by Cloudflare Access.
  // We verify the forwarded Access JWT here (not just at the edge) so the
  // endpoint is safe even if called directly.
  const admin = await getAdmin(context.request, context.env);
  if (!admin) {
    return new Response("Unauthorized", { status: 401 });
  }

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
