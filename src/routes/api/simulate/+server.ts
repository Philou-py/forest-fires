import type { RequestHandler } from "./$types";
import { exp1 } from "$lib/simulation";
import { json } from "@sveltejs/kit";

export const GET: RequestHandler = async ({ url }) => {
  const simNb = Number(url.searchParams.get("expNb"));
  const nbIters = Number(url.searchParams.get("nbIters"));
  const startVal = Number(url.searchParams.get("startVal"));

  let results;
  switch (simNb) {
    case 1:
      results = await exp1(nbIters, startVal);
      break;
    default:
      results = "No matching experience found!";
  }

  return json(results);
};
