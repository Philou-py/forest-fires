import type { RequestHandler } from "./$types";
import { exp1 } from "$lib/simulation";
import { json } from "@sveltejs/kit";

export const GET: RequestHandler = async ({ url }) => {
  const simNb = Number(url.searchParams.get("expNb") ?? 1);

  let result;
  switch(simNb) {
    case 1:
      result = await exp1();
      break;
    default:
      result = "No matching experience found!";
  }

  return json(result);
};
