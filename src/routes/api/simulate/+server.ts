import { experiment } from "$lib/simulation";
import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";

export const POST: RequestHandler = async ({ request }) => {
  const expConfig = await request.json();
  const results = await experiment(expConfig);
  return json(results);
};
