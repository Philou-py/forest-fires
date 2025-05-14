import { db } from '$lib/dgraph';
import { Mutation } from 'dgraph-js';
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { removeResults } from '../reset-exp/removeResults';

const removeConfigQuery = `
  query RemoveConfigQuery($expUid: string) {
    exp(func: uid($expUid)) {
      expConfig {
        uid
        simOptions {
          uid
        }
      }
    }
  }
`;

async function removeConfig(expUid: string) {
	const remQuery = await db.newTxn().queryWithVars(removeConfigQuery, { $expUid: expUid });
	const expConfig = remQuery.getJson().exp[0].expConfig;
	const toDelete = [{ uid: expConfig.uid }];
	if (expConfig.simOptions) toDelete.push({ uid: expConfig.simOptions.uid });

	const txn = db.newTxn();
	try {
		const mutation = new Mutation();
		mutation.setDeleteJson(toDelete);

		await txn.mutate(mutation);
		await txn.commit();
	} catch (error) {
		await txn.discard();
		return { error: "Could not remove the experiment's config!" };
	}

	return { msg: "The experiment's config was successfully removed!" };
}

export const POST: RequestHandler = async ({ request }) => {
	const { expUid }: { expUid: string } = await request.json();

	const remResult = await removeResults(expUid);
	if (remResult.error) return json(remResult);

	const remConfigRes = await removeConfig(expUid);
	if (remConfigRes.error) return json(remConfigRes);

	const txn = db.newTxn();

	try {
		const mutation = new Mutation();
		mutation.setDeleteJson({ uid: expUid });

		await txn.mutate(mutation);
		await txn.commit();
	} catch (error) {
		await txn.discard();
		return json({ error: 'Could not delete the experiment!' });
	}

	return json({ msg: 'The experiment was successfully deleted!' });
};
