import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import { db } from "$lib/dgraph";
import { Mutation } from "dgraph-js";

export const POST: RequestHandler = async ({ request }) => {
  const { expNb, expTitle, expDescription, newConfig } = await request.json();
  newConfig["dgraph.type"] = "ExpConfig";
  newConfig.uid = "_:newConfig";

  if (newConfig.simOptions) {
    newConfig.simOptions["dgraph.type"] = "SimOptions";
    newConfig.simOptions.uid = "_:newSimOptions";
  }

  const txn = db.newTxn();
  try {
    const mutation = new Mutation();
    mutation.setSetJson([{
      "dgraph.type": "Experiment",
      uid: "_:newExp",
      expTitle,
      expDescription,
      expNb,
      expConfig: newConfig
    }, newConfig]);

    const response = await txn.mutate(mutation);
    await txn.commit();

    const uids = response.getUidsMap();
    return json({
      msg: "A new experiment was successfully created!",
      expUid: uids.get("newExp"),
      configUid: uids.get("newConfig"), simOptionsUid: uids.get("newSimOptions")
    });

  } catch (error) {
    await txn.discard();
    return json({ error: "Could not create the experiment!" });
  }
}

