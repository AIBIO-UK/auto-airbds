import { store } from "../store";

export const onRequest: PagesFunction = async () => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  return new Response(JSON.stringify(store), { status: 200, headers });
};
