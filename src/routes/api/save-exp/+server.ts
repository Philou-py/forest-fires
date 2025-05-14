import { db } from '$lib/dgraph';
import type { SimResult } from '$lib/simulation';
import { Mutation } from 'dgraph-js';
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { removeResults } from '../reset-exp/removeResults';

export const POST: RequestHandler = async ({ request }) => {
	const {
		expUid,
		configUid,
		runs,
		labels,
		nextExp
	}: { expUid: string; configUid: string; runs: SimResult[]; labels: string[]; nextExp: number } =
		await request.json();

	const remResult = await removeResults(expUid);
	if (remResult.error) return json(remResult);

	const txn = db.newTxn();

	try {
		const mutation = new Mutation();
		mutation.setSetJson([{
			uid: configUid,
			nextExp,
		}, {
			uid: expUid,
			expResults: {
				'dgraph.type': 'ExpResults',
				runs: runs.map(({ nbSteps, burnPerc, burnPercByVegType, fireCentre }, i) => ({
					'dgraph.type': 'SimResult',
					runIndex: i,
					nbSteps,
					burnPerc,
					fireCentreX: fireCentre[0],
					fireCentreY: fireCentre[1],
					burnPercByVegType: burnPercByVegType.map(([vegName, vegIndex, burnPerc]) => ({
						'dgraph.type': 'BurntVeg',
						vegName,
						vegIndex,
						burnPerc
					})),
				})),
				labels: labels.map((label, i) => ({
					'dgraph.type': 'Label',
					labelName: label,
					labelIndex: i
				})),
			}
		}]);

		await txn.mutate(mutation);
		await txn.commit();
	} catch (error) {
		await txn.discard();
		return json({ error: 'Saving the experiment failed!' });
	}

	return json({ msg: 'The experiment was successfully saved!' });
};
