import type { RequestHandler } from "../update-config/$types";
import { json } from "@sveltejs/kit";
import { db } from "$lib/dgraph";
import { Mutation } from "dgraph-js";

export const POST: RequestHandler = async ({ request }) => {
  const { expUid, expTitle, expDescription, newConfig } = await request.json();
  const txn = db.newTxn();

  try {
    const mutation = new Mutation();
    mutation.setSetJson([{ uid: expUid, expTitle, expDescription }, newConfig]);

    await txn.mutate(mutation);
    await txn.commit();
  } catch (error) {
    await txn.discard();
    return json({ error: "Could not update the experiment's configuration!" });
  }

  return json({ msg: "The experiment's configuration was successfully updated!" });
}
