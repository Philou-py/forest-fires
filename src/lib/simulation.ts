import { vegWeights, densityWeights, drawCell, type DrawingBoard, MAX_BURN, baseProb, c1, c2, type Cell, createGrid, Vegetation, Density } from "$lib/fireGrid";
import { createCanvas, createImageData } from "canvas";
import { loadImages } from "$lib/mapLoading";
import { getBurnPercentage, getBurntVegTypes, getFireCentre } from "./results";

export function degToRad(angle: number) {
  return (angle * Math.PI) / 180;
}

// This list contains the relative position in the grid of neighbouring squares,
// as well as the angle of the wind from a neighbour towards the center.
export const NEIGHBOURS = [
  [-1, -1, (3 * Math.PI) / 4],
  [-1, 0, Math.PI / 2],
  [-1, 1, Math.PI / 4],
  [0, 1, 0],
  [1, 1, -Math.PI / 4],
  [1, 0, -Math.PI / 2],
  [1, -1, (-3 * Math.PI) / 4],
  [0, -1, Math.PI]
];

export function setFire(board: DrawingBoard, row?: number, col?: number) {
  board.cellsOnFire.clear();
  if (row === undefined || col === undefined) {
    row = board.height / 2;
    col = board.width / 2;
  }
  board.grid[row][col].burnDegree = 1;
  board.cellsOnFire.add([row, col]);
  drawCell(board, row, col);
  board.ctx.putImageData(board.imageData, 0, 0);
}

function sleep(millis: number) {
  return new Promise((resolve) => setTimeout(resolve, millis));
}

export type SimOptions = {
  // If set, the 'imageData' array will be updated when a cell is changed, and 'putImageData' will be called at each step.
  drawEachStep?: boolean;
  stepInterval?: number;
  windSpeed: number;
  windDir: number;
  baseProb: number;
  c1: number;
  c2: number;
};

// This function accepts the coordinates as an array coming from
// the cellsOnFire set, in order to preserve referential equality.
function updateCell(board: DrawingBoard, options: SimOptions, coords: [number, number]) {
  const [row, col] = coords;

  for (const [rowOffset, colOffset, angle] of NEIGHBOURS) {
    const neighRow = row + rowOffset;
    const neighCol = col + colOffset;

    if (neighRow < 0 || neighRow >= board.height || neighCol < 0 || neighCol >= board.width) continue;

    let neighCell = board.grid[neighRow][neighCol];
    if (neighCell.burnDegree === 0) {
      const windEffect = Math.exp(options.windSpeed * (options.c1 + options.c2 * (Math.cos(options.windDir - angle) - 1)));
      const slopeEffect = 1;

      let prob =
        options.baseProb *
        (1 + vegWeights[neighCell.veg]) *
        (1 + densityWeights[neighCell.density]) *
        windEffect *
        slopeEffect;

      if (prob > Math.random()) {
        neighCell.burnDegree = 1;
        board.cellsOnFire.add([neighRow, neighCol]);
        if (options.drawEachStep) drawCell(board, neighRow, neighCol);
      }
    }
  }

  const cell = board.grid[row][col];
  cell.burnDegree++;
  if (cell.burnDegree === MAX_BURN) {
    board.cellsOnFire.delete(coords);
    if (options.drawEachStep) drawCell(board, row, col);
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

export type SimResult = {
  nbSteps: number;
  burnPerc: number;
  burnPercByVegType: [string, number, number | null][];
  fireCentre: [number, number];
};

export type ExpResults = {
  runs: SimResult[];
  labels: string[];
  nextExp?: number;
};

export async function exp1(nbIters: number, startVal: number): Promise<ExpResults> {
  const width = 800, height = 800;
  const canvas = createCanvas(800, 800);

  const initialBoard: DrawingBoard = await loadImages(width, height, width, height, 1);

  const windSpeeds = [...Array(nbIters).keys()].map((i) => 2 * i + startVal);

  const runs = windSpeeds.map(async (windSpeed) => {
    const board: DrawingBoard = {
      ctx: canvas.getContext("2d"),
      imageData: createImageData(width, height),
      grid: structuredClone(initialBoard.grid),
      cellsOnFire: new Set(),
      width,
      height,
      canvasWidth: width,
      canvasHeight: height,
      cellWidth: 1,
      cellHeight: 1,
    };
    setFire(board);

    const options: SimOptions = {
      baseProb,
      c1,
      c2,
      windSpeed,
      windDir: 0,
    };

    const { nbSteps } = await simulate(board, options);

    return {
      nbSteps,
      burnPerc: getBurnPercentage(board),
      burnPercByVegType: getBurntVegTypes(board),
      fireCentre: getFireCentre(board),
    };
  });

  return {
    runs: await Promise.all(runs),
    labels: windSpeeds.map((speed) => `${speed} m/s`),
    nextExp: startVal + nbIters * 2
  };
}

// Test impact of the wind direction in a homogeneous map
export async function exp2(nbIters: number, startVal: number): Promise<ExpResults> {
  const width = 800, height = 800;
  const canvas = createCanvas(800, 800);

  const initialGrid: Cell[][] = createGrid(width, height, Vegetation.Forests, Density.Normal);

  const turnComplete = startVal + 10 * nbIters >= 360;
  const windDirs = [...Array(turnComplete ? (360 - startVal) / 10 : nbIters).keys()].map((i) => 10 * i + startVal);

  const runs = windDirs.map(async (windDir) => {
    const board: DrawingBoard = {
      ctx: canvas.getContext("2d"),
      imageData: createImageData(width, height),
      grid: structuredClone(initialGrid),
      cellsOnFire: new Set(),
      width,
      height,
      canvasWidth: width,
      canvasHeight: height,
      cellWidth: 1,
      cellHeight: 1,
    };
    setFire(board);

    const options: SimOptions = {
      baseProb,
      c1,
      c2,
      windSpeed: 0,
      windDir: degToRad(windDir),
    };

    const { nbSteps } = await simulate(board, options);

    return {
      nbSteps,
      burnPerc: getBurnPercentage(board),
      burnPercByVegType: getBurntVegTypes(board),
      fireCentre: getFireCentre(board),
    };
  });

  return {
    runs: await Promise.all(runs),
    labels: windDirs.map((dir) => `${dir}°`),
    nextExp: turnComplete ? undefined : startVal + 10 * nbIters,
  };
}

// Test impact of the wind direction in a complex map
export async function exp3(nbIters: number, startVal: number): Promise<ExpResults> {
  const width = 800, height = 800;
  const canvas = createCanvas(800, 800);

  const initialBoard: DrawingBoard = await loadImages(width, height, width, height, 1);

  const turnComplete = startVal + 10 * nbIters >= 360;
  const windDirs = [...Array(turnComplete ? (360 - startVal) / 10 : nbIters).keys()].map((i) => 10 * i + startVal);

  const runs = windDirs.map(async (windDir) => {
    const board: DrawingBoard = {
      ctx: canvas.getContext("2d"),
      imageData: createImageData(width, height),
      grid: structuredClone(initialBoard.grid),
      cellsOnFire: new Set(),
      width,
      height,
      canvasWidth: width,
      canvasHeight: height,
      cellWidth: 1,
      cellHeight: 1,
    };
    setFire(board);

    const options: SimOptions = {
      baseProb,
      c1,
      c2,
      windSpeed: 0,
      windDir: degToRad(windDir),
    };

    const { nbSteps } = await simulate(board, options);

    return {
      nbSteps,
      burnPerc: getBurnPercentage(board),
      burnPercByVegType: getBurntVegTypes(board),
      fireCentre: getFireCentre(board),
    };
  });

  return {
    runs: await Promise.all(runs),
    labels: windDirs.map((dir) => `${dir}°`),
    nextExp: turnComplete ? undefined : startVal + 10 * nbIters,
  };
}

