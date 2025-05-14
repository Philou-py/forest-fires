import { db } from "$lib/dgraph";
import { Mutation } from "dgraph-js";

const deleteQuery = `
	query LabelsQuery($expUid: string) {
		exp(func: uid($expUid)) {
			expResults {
				uid
				labels {
					uid
				}
				runs {
					uid
					burnPercByVegType {
						uid
					}
				}
			}
		}
	}
`;

export async function removeResults(expUid: string) {
	const res = await db.newTxn().queryWithVars(deleteQuery, { $expUid: expUid });
	const expResults = res.getJson().exp[0]?.expResults;
	if (!expResults || !expResults.runs) return { msg: "No previous results!" };
	
	let toDelete = expResults.labels.map(({ uid }: any) => ({ uid }));
	expResults.runs.forEach((run: any) => {
		toDelete.push({ uid: run.uid });
	 	run.burnPercByVegType.forEach((burntVeg: any) => {
			toDelete.push({ uid: burntVeg.uid });
		})
	});
	toDelete.push({ uid: expResults.uid });
	toDelete.push({
	  uid: expUid,
	  expResults: { uid: expResults.uid }
	});

	const txn = db.newTxn();

	try {
		const delMutation = new Mutation();
		delMutation.setDeleteJson(toDelete);

		await txn.mutate(delMutation);
		await txn.commit();
	} catch (error) {
		await txn.discard();
		console.log(error);
		console.log(toDelete);
		return { error: "Could not remove the experiment's results!" };
	}

	return { msg: "The results of the experiment were successfully removed!" };
}
