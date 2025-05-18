import {
	vegWeights,
	densityWeights,
	drawCell,
	type DrawingBoard,
	MAX_BURN,
	baseProb,
	c1,
	c2,
	c3,
	Vegetation,
	type VegWeightsType
} from '$lib/fireGrid';
import { createCanvas, createImageData } from 'canvas';
import { loadImages } from '$lib/mapLoading';
import { getBurnPercentage, getBurntVegTypes, getFireCentre, mergeRuns } from './results';

export function degToRad(angle: number) {
	return (angle * Math.PI) / 180;
}

// These numbers represent the relative position of neighbouring squares in the grid,
// as well as the angle of the wind from the cell to its neighbour, and the distance
// between the two.
export type NeighbourhoodType = [number, number, number, number][];

export const VON_NEUMANN: NeighbourhoodType = [
	[-1, 0, Math.PI / 2, 1],
	[0, 1, 0, 1],
	[1, 0, -Math.PI / 2, 1],
	[0, -1, Math.PI, 1]
];

export function mooreNeigh(spread: number): NeighbourhoodType {
	const neighCells: [number, number, number, number][] = [];

	for (let i = -spread; i <= spread; i++) {
		for (let j = -spread; j <= spread; j++)
			if (!(i === 0 && j === 0)) {
				const angle = j < 0 ? Math.PI + Math.atan(i / -j) : Math.atan(-i / j);
				neighCells.push([i, j, angle, Math.sqrt(i ** 2 + j ** 2)]);
			}
	}

	return neighCells;
}

export function setFire(board: DrawingBoard, row?: number, col?: number): [number, number] {
	board.cellsOnFire.forEach(([row, col]) => {
		board.grid[row][col].burnDegree = 0;
		drawCell(board, row, col);
	});
	board.cellsOnFire.clear();

	if (row === undefined || col === undefined) {
		row = board.height / 2;
		col = board.width / 2;
	}
	board.grid[row][col].burnDegree = 1;
	board.cellsOnFire.add([row, col]);
	drawCell(board, row, col);
	board.ctx.putImageData(board.imageData, 0, 0);

	return [row, col];
}

function sleep(millis: number) {
	return new Promise((resolve) => setTimeout(resolve, millis));
}

export type SimOptions = {
	uid: string;
	neighbourhood: NeighbourhoodType;
	mooreSpread?: number;
	// If set, the 'imageData' array will be updated when a cell is changed, and 'putImageData' will be called at each step.
	drawEachStep?: boolean;
	stepInterval?: number;
	windSpeed: number;
	windDir: number;
	baseProb: number;
	c1: number;
	c2: number;
	c3: number;
	vegWeights: VegWeightsType;
};

// This function accepts the coordinates as an array coming from
// the cellsOnFire set, in order to preserve referential equality.
function updateCell(board: DrawingBoard, options: SimOptions, coords: [number, number]) {
	const [row, col] = coords;

	for (const [rowOffset, colOffset, angle, distance] of options.neighbourhood) {
		const neighRow = row + rowOffset;
		const neighCol = col + colOffset;

		if (neighRow < 0 || neighRow >= board.height || neighCol < 0 || neighCol >= board.width)
			continue;

		let neighCell = board.grid[neighRow][neighCol];
		if (neighCell.burnDegree === 0) {
			const windEffect = Math.exp(
				options.windSpeed * (options.c1 + options.c2 * (Math.cos(options.windDir - angle) - 1))
			);
			const slopeEffect = 1;
			const distanceEffect = Math.exp(-options.c3 * (distance - 1));

			let prob =
				options.baseProb *
				(1 + options.vegWeights[neighCell.veg]) *
				(1 + densityWeights[neighCell.density]) *
				windEffect *
				slopeEffect *
				distanceEffect;

			if (prob > Math.random()) {
				neighCell.burnDegree = 1;
				board.cellsOnFire.add([neighRow, neighCol]);
				if (options.drawEachStep) drawCell(board, neighRow, neighCol);
			}
		}
	}

	const cell = board.grid[row][col];
	if (cell.burnDegree === MAX_BURN) {
		board.cellsOnFire.delete(coords);
		if (options.drawEachStep) drawCell(board, row, col);
	} else {
		cell.burnDegree++;
	}
}

export async function simulate(board: DrawingBoard, options: SimOptions) {
	const startTime = Date.now();
	let nbSteps = 0;

	while (board.cellsOnFire.size > 0) {
		nbSteps++;
		// 'updateCell' will update 'cellsOnFire', hence the need to store the number
		// of elements to consider in each step
		const nbCellsOnFire = board.cellsOnFire.size;
		// The 'values' iterator is guaranteed to return the elements of the set
		// in insertion order
		const cellsIterator = board.cellsOnFire.values();

		for (let i = 0; i < nbCellsOnFire; i++) {
			updateCell(board, options, cellsIterator.next().value!);
		}

		if (options.drawEachStep) board.ctx.putImageData(board.imageData, 0, 0);

		if (options.stepInterval && options.stepInterval > 0) await sleep(options.stepInterval);
	}

	return {
		nbSteps,
		elapsed: Date.now() - startTime
	};
}

export type ExpConfig = {
	uid?: string;
	nbIters?: number;
	nbReps: number;
	begNbReps: number;
	width?: number;
	height?: number;
	maps?: ('vegetation' | 'density' | 'roads' | 'waterlines')[];
	pixelThickness?: number;
	useDensity: boolean;
	neighbourhood?: 'Von Neumann' | 'Moore';
	firePos?: [number, number];
	variable: string;
	startVal: number;
	nextExp?: number;
	max?: number;
	step: number;
	labelFormat: string;
	simOptions?: Partial<SimOptions>;
};

export type SimResult = {
	nbSteps: number;
	burnPerc: number;
	// Vegetation name, index and burn percentage if it exists
	burnPercByVegType: [string, number, number | null][];
	fireCentre: [number, number];
};

export type ExpResults = {
	runs: SimResult[];
	labels: string[];
};

export async function experiment(expConfig: ExpConfig): Promise<ExpResults> {
	if (!expConfig.nbIters) expConfig.nbIters = 5;
	if (!expConfig.nbReps) expConfig.nbReps = expConfig.begNbReps;
	if (!expConfig.nextExp) expConfig.nextExp = expConfig.startVal;
	if (!expConfig.simOptions) expConfig.simOptions = {};
	if (!expConfig.simOptions.windSpeed) expConfig.simOptions.windSpeed = 0;
	if (!expConfig.simOptions.windDir) expConfig.simOptions.windDir = 0;
	if (!expConfig.simOptions.baseProb) expConfig.simOptions.baseProb = baseProb;
	if (!expConfig.simOptions.c1) expConfig.simOptions.c1 = c1;
	if (!expConfig.simOptions.c2) expConfig.simOptions.c2 = c2;
	if (!expConfig.simOptions.c3) expConfig.simOptions.c3 = c3;
	if (!expConfig.simOptions.vegWeights) expConfig.simOptions.vegWeights = vegWeights;
	if (!expConfig.maps) expConfig.maps = [];
	if (expConfig.useDensity) expConfig.maps.push('density');

	if (expConfig.neighbourhood === 'Von Neumann') expConfig.simOptions.neighbourhood = VON_NEUMANN;
	else expConfig.simOptions.neighbourhood = mooreNeigh(expConfig.simOptions.mooreSpread ?? 1);

	const width = expConfig.width ?? 800,
		height = expConfig.height ?? 800;
	const canvas = createCanvas(width, height);

	const initialBoard: DrawingBoard = await loadImages(
		width,
		height,
		width,
		height,
		expConfig.pixelThickness ?? 1,
		expConfig.maps
	);

	const expComplete = expConfig.max
		? expConfig.nextExp! + expConfig.step * expConfig.nbIters >= expConfig.max
		: false;
	const testVals = [
		...Array(
			expComplete ? (expConfig.max! - expConfig.nextExp!) / expConfig.step : expConfig.nbIters
		).keys()
	].map((i) => expConfig.step * i + expConfig.nextExp!);

	console.log("nbIters", expConfig.nbIters);
	console.log("nbReps", expConfig.nbReps);
	console.log("testVals", testVals);

	let runs: SimResult[] = [];
	let nbReps = 0;

	for (let rep = 0; rep < expConfig.nbReps!; rep++) {
		const newRuns = [];

		for (const testVal of testVals) {
			const board: DrawingBoard = {
				ctx: canvas.getContext('2d'),
				imageData: createImageData(width, height),
				grid: structuredClone(initialBoard.grid),
				cellsOnFire: new Set(),
				width,
				height,
				canvasWidth: width,
				canvasHeight: height,
				cellWidth: 1,
				cellHeight: 1
			};
			if (expConfig.firePos) setFire(board, ...expConfig.firePos);
			else setFire(board);

			if (expConfig.variable === 'mooreSpread') {
				expConfig.simOptions!.neighbourhood = mooreNeigh(testVal);
			} else if (expConfig.variable.startsWith('vegWeights')) {
				const variable = expConfig.variable.split('.')[1] as keyof typeof Vegetation;
				expConfig.simOptions!.vegWeights![Vegetation[variable]] = testVal;
			} else {
				expConfig.simOptions![expConfig.variable as keyof SimOptions] = testVal as never;
			}

			const { nbSteps } = await simulate(board, expConfig.simOptions as SimOptions);

			newRuns.push({
				nbSteps,
				burnPerc: getBurnPercentage(board),
				burnPercByVegType: getBurntVegTypes(board),
				fireCentre: getFireCentre(board)
			});
		}

		if (nbReps === 0) runs = newRuns;
		mergeRuns(runs, nbReps, newRuns, 1);
		nbReps++;
	}

	const labels = testVals.map((v) =>
		expConfig.labelFormat.replace('%s', (Math.round(v * 100) / 100).toString())
	);

	expConfig.nextExp = expComplete ? undefined : expConfig.nextExp! + expConfig.step * expConfig.nbIters;
	return { runs, labels };
}

// export const exp1Config: ExpConfig = {
// 	// If not specified, set to "Moore"
// 	neighbourhood: 'Moore',

// 	// This represents the spread radius of the Moore neighbourhood. The default value is 1.
// 	mooreSpread: 1,

// 	// If not specified, all maps are included.
// 	// An empty array corresponds to the fully wooded grid.
// 	// Possible values include "vegetation", "roads" and "waterlines".
// 	// maps: [],

// 	// The default number of iterations to run at once suggested on the dashboard
// 	// More than 40 iterations will probably crash (memory limit)
// 	nbIters: 5,

// 	useDensity: true,

// 	// Any parameter in SimOptions (except for 'neighbourhood', 'drawEachStep' and 'stepInterval')
// 	// To make a value in 'vegWeights' vary, use the dot notation (ex: 'vegWeights.Agriculture')
// 	// To make the Moore spread radius vary, refer to 'mooreSpread'
// 	variable: 'windSpeed',

// 	startVal: 0,
// 	// max is optional

// 	step: 1,

// 	// '%s' will be replaced with the parameter
// 	labelFormat: '%s m/s',

// 	// Any simulation option can be modified
// 	simOptions: {
// 		baseProb: 0.5
// 	}
// };
