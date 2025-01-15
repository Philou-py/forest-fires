import { Vegetation, type VegType, type DrawingBoard } from "$lib/fireGrid";

export function countBurntCells(board: DrawingBoard): number {
	let burntCount = 0;
	for (let row = 0; row < board.height; row++) {
		for (let col = 0; col < board.width; col++) {
			if (board.grid[row][col].burnDegree > 0) burntCount++;
		}
	}
	return burntCount;
}

export function getBurnPercentage(board: DrawingBoard): number {
	return countBurntCells(board) / (board.width * board.height) * 100;
}

// Computes the percentage of burnt area for each vegetation type
export function getBurntVegTypes(board: DrawingBoard): [string, number, number][] {
	const vegs = Object.values(Vegetation).filter((veg) => veg !== 0);
	const burntByVeg: Map<VegType, number> = new Map(vegs.map((veg) => [veg, 0]));
	const vegCount: Map<VegType, number> = new Map(vegs.map((veg) => [veg, 0]));

	for (let row = 0; row < board.height; row++) {
		for (let col = 0; col < board.width; col++) {
			const veg = board.grid[row][col].veg;
			vegCount.set(veg, vegCount.get(veg)! + 1);

			if (board.grid[row][col].burnDegree > 0) {
				burntByVeg.set(veg, burntByVeg.get(veg)! + 1);
			}
		}
	}

	return Object.entries(Vegetation)
		.filter(([vegType, _]) => vegType !== "NoVeg")
		.map(([vegName, veg]) => [vegName, veg, burntByVeg.get(veg)! / vegCount.get(veg)! * 100]);
}

export function getFireCentre(board: DrawingBoard): [number, number] {
	let rowSum = 0, colSum = 0;
	let burntCells = 0;

	for (let row = 0; row < board.height; row++) {
		for (let col = 0; col < board.width; col++) {
			if (board.grid[row][col].burnDegree > 0) {
				burntCells++;
				rowSum += row;
				colSum += col;
			}
		}
	}

	return [rowSum / burntCells, colSum / burntCells];
}

// Implements the moving average algorithm with a sampling width of 2 * radius + 1
export function smoothData(data: any[], readData: (i: number) => number, setData: (i: number, val: number) => void, radius: number) {
	// Keeps track of the number of values summed in 'currentSum'
	let width = Math.min(data.length, radius);

	let currentSum = 0;
	for (let i = 0; i < width; i++) currentSum += readData(i);

	for (let i = 0; i < data.length; i++) {
		if (i + radius < data.length) {
			currentSum += readData(i + radius);
			width++;
		}
		if (i > radius) {
			currentSum -= readData(i - radius - 1);
			width--;
		}
		setData(i, currentSum / width);
	}

	let steepestSlope = 0;
	let steepestAxis = 0;
	for (let i = 0; i < data.length - 1; i++) {
		const slope = Math.abs(readData(i + 1) - readData(i));
		if (slope > steepestSlope) {
			steepestSlope = slope;
			steepestAxis = i;
		}
	}
	return [steepestSlope, steepestAxis];
}

