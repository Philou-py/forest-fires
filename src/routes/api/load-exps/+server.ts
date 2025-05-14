import type { RequestHandler } from "./$types";
import { db } from "$lib/dgraph";
import type { ExpConfig } from "$lib/simulation";
import { Mutation } from "dgraph-js";
import { json } from "@sveltejs/kit";

const exp1Config: ExpConfig = {
	neighbourhood: 'Moore',
	maps: [],
	useDensity: false,
	nbIters: 20,
	begNbReps: 3,
	nbReps: 3,
	variable: 'baseProb',
	startVal: 0.1,
	step: 0.1,
	labelFormat: '%s',
};

const exp2Config: ExpConfig = {
	neighbourhood: 'Moore',
	maps: [],
	useDensity: false,
	nbIters: 4,
	begNbReps: 10,
	nbReps: 10,
	variable: 'mooreSpread',
	startVal: 1,
	step: 1,
	labelFormat: '%s',
	simOptions: {
		baseProb: 0.28,
	}
};

const exp3Config: ExpConfig = {
	neighbourhood: 'Von Neumann',
	maps: [],
	useDensity: false,
	nbIters: 20,
	begNbReps: 3,
	nbReps: 3,
	variable: 'baseProb',
	startVal: 0.1,
	step: 0.1,
	labelFormat: '%s'
};

const exp4Config: ExpConfig = {
	neighbourhood: 'Moore',
	maps: [],
	useDensity: false,
	nbIters: 30,
	begNbReps: 5,
	nbReps: 5,
	variable: 'baseProb',
	startVal: 1,
	step: 1,
	labelFormat: '%s',
	simOptions: {
		mooreSpread: 1,
		windSpeed: 20,
		baseProb: 0.3,
	}
};

const exp5Config: ExpConfig = {
	neighbourhood: 'Von Neumann',
	maps: [],
	useDensity: false,
	nbIters: 30,
	begNbReps: 3,
	nbReps: 3,
	variable: 'windSpeed',
	startVal: 1,
	step: 1,
	labelFormat: '%s',
	simOptions: {
		baseProb: 0.3,
	}
};

const exp6Config: ExpConfig = {
	neighbourhood: 'Von Neumann',
	maps: [],
	useDensity: false,
	nbIters: 30,
	begNbReps: 3,
	nbReps: 3,
	variable: 'windSpeed',
	startVal: 1,
	step: 1,
	labelFormat: '%s',
	simOptions: {
		baseProb: 0.3,
		windDir: 45,
	}
};

const exp7Config: ExpConfig = {
	neighbourhood: 'Moore',
	maps: [],
	useDensity: false,
	nbIters: 20,
	begNbReps: 3,
	nbReps: 3,
	variable: 'baseProb',
	startVal: 0.1,
	step: 0.1,
	labelFormat: '%s',
};

const exp8Config: ExpConfig = {
	neighbourhood: 'Moore',
	maps: [],
	useDensity: false,
	nbIters: 4,
	begNbReps: 10,
	nbReps: 10,
	variable: 'mooreSpread',
	startVal: 1,
	step: 1,
	labelFormat: '%s',
	simOptions: {
		baseProb: 0.28,
	}
};

const exp9Config: ExpConfig = {
	neighbourhood: 'Von Neumann',
	maps: [],
	useDensity: false,
	nbIters: 20,
	begNbReps: 3,
	nbReps: 3,
	variable: 'baseProb',
	startVal: 0.1,
	step: 0.1,
	labelFormat: '%s'
};

const exp10Config: ExpConfig = {
	neighbourhood: 'Moore',
	maps: [],
	useDensity: false,
	nbIters: 30,
	begNbReps: 5,
	nbReps: 5,
	variable: 'baseProb',
	startVal: 1,
	step: 1,
	labelFormat: '%s',
	simOptions: {
		mooreSpread: 1,
		windSpeed: 20,
		baseProb: 0.3,
	}
};

const exp11Config: ExpConfig = {
	neighbourhood: 'Von Neumann',
	maps: [],
	useDensity: false,
	nbIters: 30,
	begNbReps: 3,
	nbReps: 3,
	variable: 'windSpeed',
	startVal: 1,
	step: 1,
	labelFormat: '%s',
	simOptions: {
		baseProb: 0.3,
	}
};

const exp12Config: ExpConfig = {
	neighbourhood: 'Von Neumann',
	maps: [],
	useDensity: false,
	nbIters: 30,
	begNbReps: 3,
	nbReps: 3,
	variable: 'windSpeed',
	startVal: 1,
	step: 1,
	labelFormat: '%s',
	simOptions: {
		baseProb: 0.3,
		windDir: 45,
	}
};

const expConfigs: any[] = [exp1Config, exp2Config, exp3Config, exp4Config, exp5Config, exp6Config, exp7Config, exp8Config, exp9Config, exp10Config, exp11Config, exp12Config];

export const POST: RequestHandler = async () => {
	const txn = db.newTxn();

	try {
		for (const [i, expConfig] of expConfigs.entries()) {
			const mutation = new Mutation();

			expConfig["dgraph.type"] = "ExpConfig";
			if (expConfig.simOptions) expConfig.simOptions["dgraph.type"] = "SimOptions";

			mutation.setSetJson({
				"dgraph.type": "Experiment",
				expTitle: `Expérience ${i + 1}`,
				expDescription: "",
				expNb: i,
				expConfig,
			});

			await txn.mutate(mutation);
		}

		await txn.commit();
	} catch (error) {
		await txn.discard();
		return json({ msg: "Could not load experiments!" });
	}

	return json({ msg: "Successfully loaded experiments!" });
}

