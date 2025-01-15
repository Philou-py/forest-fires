import { CanvasRenderingContext2D, ImageData } from "canvas";

export const Vegetation = {
  NoVeg: 0,
  Agriculture: 1,
  Forests: 2,
  Shrublands: 3,
  PrimaryRoad: 4,
  SecondaryRoad: 5,
  TertiaryRoad: 6,
  Waterline: 7
} as const;
// VegType is a value in the list [0, .., 7]
export type VegType = (typeof Vegetation)[keyof typeof Vegetation];

// export const vegWeights = {
//   [Vegetation.NoVeg]: -1,
//   [Vegetation.Agriculture]: -0.4,
//   [Vegetation.Forests]: 0.4,
//   [Vegetation.Shrublands]: 0.4,
//   [Vegetation.PrimaryRoad]: -0.8,
//   [Vegetation.SecondaryRoad]: -0.7,
//   [Vegetation.TertiaryRoad]: -0.4,
//   [Vegetation.Waterline]: -0.4
// } as const;
export type VegWeightsType = { [key in keyof typeof vegWeights]: number };

export const vegWeights = {
  [Vegetation.NoVeg]: -1,
  [Vegetation.Agriculture]: -0.4,
  [Vegetation.Forests]: 0.4,
  [Vegetation.Shrublands]: 0.4,
  [Vegetation.PrimaryRoad]: -0.7,
  [Vegetation.SecondaryRoad]: -0.6,
  [Vegetation.TertiaryRoad]: -0.5,
  [Vegetation.Waterline]: -0.8
};

export const Density = {
  NoVeg: 0,
  Sparse: 1,
  Normal: 2,
  Dense: 3,
} as const;
export type DensityType = (typeof Density)[keyof typeof Density];

export const densityWeights = {
  [Density.NoVeg]: -1,
  [Density.Sparse]: -0.3,
  [Density.Normal]: 0,
  [Density.Dense]: 0.3,
} as const;

export type Cell = {
  veg: VegType;
  density: DensityType;
  burnDegree: 0 | 1 | 2 | 3;
};
export const MAX_BURN = 1;

export type DrawingBoard = {
  ctx: CanvasRenderingContext2D,
  imageData: ImageData,
  grid: Cell[][],
  cellsOnFire: Set<[number, number]>,
  width: number,
  height: number,
  canvasWidth: number,
  canvasHeight: number,
  cellWidth: number,
  cellHeight: number,
};

export const baseProb = 0.4; // 0.58 is the recommended value
export const c1 = 0.045;
export const c2 = 0.131;

// Colour values are given as [R, G, B, A]
export const Colours = {
  [Vegetation.NoVeg]: [255, 255, 255, 255], // [146, 147, 147, 255] #929393 (concrete)
  [Vegetation.Forests]: [141, 227, 104, 255], // light green
  [Vegetation.Shrublands]: [220, 239, 78, 255], // yellow-green
  [Vegetation.Agriculture]: [81, 210, 188, 255], // turquoise
  [Vegetation.PrimaryRoad]: [129, 104, 253, 255], // purple
  [Vegetation.SecondaryRoad]: [255, 208, 26, 255], // yellow
  [Vegetation.TertiaryRoad]: [62, 255, 62, 255], // bright green
  [Vegetation.Waterline]: [79, 172, 243, 255] // medium blue
};
export type ColType = [number, number, number, number];

export const FireColours = [
  [255, 87, 34, 255],
  [221, 44, 0, 255],
  [191, 54, 12, 255]
]; // ['#FF5722', '#DD2C00', '#BF360C']

export const DensityAlphas = {
  [Density.NoVeg]: 63,
  [Density.Sparse]: 126,
  [Density.Normal]: 189,
  [Density.Dense]: 255,
} as const;

export function createGrid(width: number, height: number, initialVeg?: VegType, initialDensity?: DensityType) {
  let grid: Cell[][] = new Array(height);

  for (let i = 0; i < height; i++) {
    grid[i] = new Array(width);

    for (let j = 0; j < width; j++) {
      grid[i][j] = {
        veg: initialVeg ?? Vegetation.NoVeg,
        density: initialDensity ?? Density.Normal,
        burnDegree: 0
      };
    }
  }

  return grid;
}

export function drawCell(board: DrawingBoard, row: number, col: number) {
  const cell = board.grid[row][col];
  const colour = cell.burnDegree == 0 ? Colours[cell.veg] : FireColours[cell.burnDegree - 1];
  colour[3] = DensityAlphas[cell.density];

  // 'imageData.data' is a flattened array storing each pixel as 4 colour components (R, G, B, A)
  const baseIndex = row * 4 * board.canvasWidth * board.cellHeight + col * 4 * board.cellWidth;
  const endIndex = baseIndex + 4 * board.canvasWidth * board.cellHeight;
  for (let i = baseIndex; i < endIndex; i += 4 * board.canvasWidth) {
    for (let j = 0; j < 4 * board.cellWidth; j += 4) {
      board.imageData.data.set(colour, i + j);
    }
  }
}

// Thickness represents the upper integer part of half the height (or width) of the square that is to be drawn
export function drawSquare(board: DrawingBoard, row: number, col: number, veg: VegType, dens: DensityType, thickness: number) {
  const startRow = Math.max(0, row - thickness + 1);
  const endRow = Math.min(board.height, row + thickness);
  const startCol = Math.max(0, col - thickness + 1);
  const endCol = Math.min(board.width, col + thickness);

  for (let i = startRow; i < endRow; i++) {
    for (let j = startCol; j < endCol; j++) {
      board.grid[i][j] = {
        veg,
        density: dens,
        burnDegree: 0
      };
    }
  }
}

// Fill the grid with forests on the squares where no vegetation is present
export function fillNoVeg(board: DrawingBoard) {
  for (let row = 0; row < board.height; row++) {
    for (let col = 0; col < board.width; col++) {
      if (board.grid[row][col].veg == Vegetation.NoVeg)
        board.grid[row][col].veg = Vegetation.Forests;
      drawCell(board, row, col);
    }
  }
  board.ctx.putImageData(board.imageData, 0, 0);
}

