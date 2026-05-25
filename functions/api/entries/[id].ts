import { store } from "../../store";

export const onRequestDelete: PagesFunction = async ({ params }) => {
  const id = params.id as string;
  const idx = store.findIndex((e) => e.id === id);

  if (idx === -1) {
    return new Response("Not found", { status: 404 });
  }

  store.splice(idx, 1);

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
