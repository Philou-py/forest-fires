import { vegWeights, densityWeights, drawCell, type DrawingBoard, MAX_BURN, baseProb, c1, c2, Vegetation, type VegWeightsType } from "$lib/fireGrid";
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
  // If set, the 'imageData' array will be updated when a cell is changed, and 'putImageData' will be called at each step.
  drawEachStep?: boolean;
  stepInterval?: number;
  windSpeed: number;
  windDir: number;
  baseProb: number;
  c1: number;
  c2: number;
  vegWeights: VegWeightsType;
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
        (1 + options.vegWeights[neighCell.veg]) *
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
  nbIters?: number,
  startVal?: number,
  width?: number,
  height?: number,
  maps?: ("vegetation" | "density" | "roads" | "waterlines")[],
  pixelThickness?: number,
  useDensity: boolean,
  firePos?: [number, number],
  simOptions?: Partial<SimOptions>,
  variable: string,
  min: number,
  max?: number,
  step: number,
  labelFormat: string,
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
  nextExp?: number;
};

export async function experiment(expConfig: ExpConfig): Promise<ExpResults> {
  if (!expConfig.nbIters) expConfig.nbIters = 5;
  if (!expConfig.startVal) expConfig.startVal = 0;
  if (!expConfig.simOptions) expConfig.simOptions = {}
  if (!expConfig.simOptions.windSpeed) expConfig.simOptions.windSpeed = 0;
  if (!expConfig.simOptions.windDir) expConfig.simOptions.windDir = 0;
  if (!expConfig.simOptions.baseProb) expConfig.simOptions.baseProb = baseProb;
  if (!expConfig.simOptions.c1) expConfig.simOptions.c1 = c1;
  if (!expConfig.simOptions.c2) expConfig.simOptions.c2 = c2;
  if (!expConfig.simOptions.vegWeights) expConfig.simOptions.vegWeights = vegWeights;
  if (!expConfig.maps) expConfig.maps = ["vegetation", "roads", "waterlines"]
  if (expConfig.useDensity) expConfig.maps.push("density");

  const width = expConfig.width ?? 800, height = expConfig.height ?? 800;
  const canvas = createCanvas(width, height);

  const initialBoard: DrawingBoard = await loadImages(width, height, width, height, expConfig.pixelThickness ?? 1, expConfig.maps);

  const expComplete = expConfig.max ? expConfig.startVal + expConfig.step * expConfig.nbIters >= expConfig.max : false;
  const testVals =
    [...Array(expComplete ? (expConfig.max! - expConfig.startVal) / expConfig.step : expConfig.nbIters).keys()]
      .map((i) => expConfig.step * i + expConfig.startVal!);

  const runs = testVals.map(async (testVal) => {
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
    if (expConfig.firePos) setFire(board, ...expConfig.firePos);
    else setFire(board);

    if (expConfig.variable.startsWith("vegWeights")) {
      const variable = expConfig.variable.split(".")[1] as keyof typeof Vegetation;
      expConfig.simOptions!.vegWeights![Vegetation[variable]] = testVal;
    } else {
      expConfig.simOptions![expConfig.variable as keyof SimOptions] = testVal as never;
    }

    const { nbSteps } = await simulate(board, expConfig.simOptions as SimOptions);

    return {
      nbSteps,
      burnPerc: getBurnPercentage(board),
      burnPercByVegType: getBurntVegTypes(board),
      fireCentre: getFireCentre(board),
    };
  });

  return {
    runs: await Promise.all(runs),
    labels: testVals.map((v) => expConfig.labelFormat.replace("%s", (Math.round(v * 100) / 100).toString())),
    nextExp: expComplete ? undefined : expConfig.startVal + expConfig.step * expConfig.nbIters
  };
}

export const exp1Config: ExpConfig = {
  nbIters: 5,
  useDensity: true,
  variable: "windSpeed",
  min: 0,
  step: 0.5,
  labelFormat: "%s m/s",
};

export const exp2Config: ExpConfig = {
  nbIters: 5,
  maps: [],
  useDensity: false,
  variable: "windDir",
  min: 0,
  max: 360,
  step: 10,
  labelFormat: "%s°",
};

export const exp3Config: ExpConfig = {
  nbIters: 5,
  useDensity: true,
  variable: "windDir",
  min: 0,
  max: 360,
  step: 10,
  labelFormat: "%s°",
};

