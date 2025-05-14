import { db } from "$lib/dgraph";
import { Mutation } from "dgraph-js";
import type { RequestHandler } from "./$types";
import { json } from '@sveltejs/kit';
import { removeResults } from "./removeResults";

async function resetExp(expUid: string, expConfigUid: string, begNbReps: number) {
	const remResult = await removeResults(expUid);
	if (remResult.error) return remResult;
	console.log(remResult);

	const txn = db.newTxn();
	try {
		const mutation = new Mutation();
		mutation.setSetJson({
			uid: expConfigUid,
			nbReps: begNbReps,
		});

		await txn.mutate(mutation);
		await txn.commit();
	} catch (error) {
		await txn.discard();
		return { error: "Could not reset the experiment!" };
	}
	return { msg: "The experiment was successfully reset!" };
}

export const POST: RequestHandler = async ({ request }) => {
	const { expUid, expConfigUid, begNbReps }: { expUid: string; expConfigUid: string, begNbReps: number } = await request.json();
	const resetResult = await resetExp(expUid, expConfigUid, begNbReps);
	if ('error' in resetResult) return json(resetResult);

	return json(resetResult);
}


