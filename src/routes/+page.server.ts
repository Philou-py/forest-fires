import { db } from '$lib/dgraph';
import type { ExpConfig, ExpResults } from '$lib/simulation';
import type { PageServerLoad } from './$types';

const experimentsQuery = `
  query ExperimentsQuery {
    experiments(func: type(Experiment), orderasc: expTitle) {
      uid
      expTitle
      expDescription
      expNb
      ongoing
      expConfig {
        uid
        nbIters
        nbReps
        begNbReps
        width
        height
        maps
        pixelThickness
        useDensity
        neighbourhood
        firePosX
        firePosY
        variable
        startVal
        nextExp
        max
        step
        labelFormat
        simOptions {
        	uid
          mooreSpread
          windSpeed
          windDir
          baseProb
          c1
          c2
          c3
        }
      }
      expResults {
        runs (orderasc: runIndex) {
          nbSteps
          burnPerc
          burnPercByVegType (orderasc: vegIndex) {
            vegName
            vegIndex
            burnPerc
          }
          fireCentreX
          fireCentreY
        }
        labels (orderasc: labelIndex) {
          labelName
        }
      }
    }
  }
`;

export type ExpData = {
	uid: string;
	expTitle: string;
	expDescription?: string;
	expNb: number;
	ongoing?: boolean;
	expConfig: ExpConfig;
	expResults?: ExpResults;
};

export const load: PageServerLoad = async () => {
	const queryRes = await db.newTxn().query(experimentsQuery);
	const experiments = queryRes.getJson().experiments;

	experiments.forEach(({ expConfig, expResults }: any) => {
		if (expConfig.firePosX) expConfig.firePos = [expConfig.firePosX, expConfig.firePosY];
		delete expConfig.firePosX;
		delete expConfig.firePosY;

		if (expResults && expResults.runs) {
			expResults.runs.forEach((run: any) => {
				run.burnPercByVegType = run.burnPercByVegType.map((burntVeg: any) => [
					burntVeg.vegName,
					burntVeg.vegIndex,
					burntVeg.burnPerc
				]);

				run.fireCentre = [run.fireCentreX, run.fireCentreY];
				delete run.fireCentreX;
				delete run.fireCentreY;
			});

			expResults.labels = expResults.labels.map(({ labelName }: any) => labelName);
		} else if (expResults) {
			expResults.runs = [];
			expResults.labels = [];
			expResults.nextExp = expConfig.startVal;
		}
	});

	return { experiments } as { experiments: ExpData[] };
};
