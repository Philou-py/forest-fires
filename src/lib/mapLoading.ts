import { createCanvas, createImageData, loadImage } from "canvas";
import type { DrawingBoard, VegType, ColType, DensityType } from "$lib/fireGrid";
import { createGrid, Density, drawSquare, fillNoVeg, Vegetation } from "$lib/fireGrid";
import vegMap from "./maps/vegetation-map.png";
import roadsMap from "./maps/roads-map.png";
import waterlinesMap from "./maps/waterlines-map.png";
import densityMap from "./maps/density-map.png";
// import { createWriteStream } from "fs";

export type ColourMapping = [ColType, VegType][];
export type DensityMapping = [ColType, DensityType][];

// A partial mapping for the black contour
const noVegMapping: ColourMapping = [
  [[28, 28, 28, 255], Vegetation.NoVeg],
  [[115, 115, 115, 255], Vegetation.NoVeg],
  [[141, 141, 141, 255], Vegetation.NoVeg],
  [[197, 197, 197, 255], Vegetation.NoVeg]
] as const;

const noVegDensMapping: DensityMapping = noVegMapping.map(([col, _]) => [col, Density.Normal]);

export const roadsMapping: ColourMapping = [
  [[255, 0, 0, 255], Vegetation.PrimaryRoad],
  [[255, 168, 168, 255], Vegetation.PrimaryRoad],
  [[255, 200, 0, 255], Vegetation.SecondaryRoad],
  [[255, 221, 85, 255], Vegetation.SecondaryRoad],
  [[0, 255, 0, 255], Vegetation.TertiaryRoad],
  [[137, 255, 137, 255], Vegetation.TertiaryRoad],
  ...noVegMapping
];

export const vegMapping: ColourMapping = [
  [[255, 230, 0, 255], Vegetation.Forests],
  [[255, 100, 0, 255], Vegetation.Shrublands],
  [[170, 0, 0, 255], Vegetation.Agriculture],
  ...noVegMapping
];

export const densityMapping: DensityMapping = [
  [[0, 127, 0, 255], Density.Dense],
  [[153, 255, 153, 255], Density.Normal],
  [[255, 199, 126, 255], Density.Sparse],
  ...noVegDensMapping
];

export const waterMapping: ColourMapping = [[[6, 200, 255, 255], Vegetation.Waterline]];

// Weighted Euclidian distance between two colours normalized between 0 and 1
// 65025 is the distance between black and white
function colourDist([r1, g1, b1]: readonly number[], [r2, g2, b2]: readonly number[]) {
  return (0.3 * (r1 - r2) ** 2 + 0.59 * (g1 - g2) ** 2 + 0.11 * (b1 - b2) ** 2) / 65025;
}

function loadGridFromImg(board: DrawingBoard, url: string, mapping: ColourMapping, type: "vegFg" | "vegBg", pixelThickness: number)
  : Promise<void>
function loadGridFromImg(board: DrawingBoard, url: string, mapping: DensityMapping, type: "density")
  : Promise<void>
function loadGridFromImg(board: DrawingBoard, url: string, mapping: ColourMapping | DensityMapping, type: "vegFg" | "vegBg" | "density", pixelThickness?: number)
  : Promise<void> {
  return new Promise((resolve) => {
    // Remove the slash so as to have a relative path (to the project root)
    loadImage(url.startsWith("/") ? url.slice(1) : url).then((img) => {
      board.ctx.drawImage(img, 0, 0, board.width, board.height);
      const loadedData = board.ctx.getImageData(0, 0, board.width, board.height).data;

      let row = 0;
      let col = 0;
      for (let i = 0; i < loadedData.length; i += 4) {
        const pixelCol = [loadedData[i], loadedData[i + 1], loadedData[i + 2]];
        // Find the closest matching colour
        const [closestItem, dist] = mapping.reduce(
          ([minItem, minDist], [col, item]) => {
            const dist = colourDist(pixelCol, col);
            return dist < minDist ? [item, dist] : [minItem, minDist];
          },
          [mapping[0][1], 1]
        );

        if (dist < 0.1) {
          if (type === "vegBg" || (type === "vegFg" && closestItem !== Vegetation.NoVeg))
            drawSquare(board, row, col, closestItem as VegType, Density.Normal, pixelThickness!);
          else if (type === "density")
            board.grid[row][col].density = closestItem as DensityType;
        }

        if (col == board.width - 1) {
          row++;
          col = 0;
        } else {
          col++;
        }
      }

      resolve();
    });
  });
}

export async function loadForestWithDensity(width: number, height: number, canvasWidth: number, canvasHeight: number) {
  const canvas = createCanvas(width, height);

  const drawingBoard: DrawingBoard = {
    ctx: canvas.getContext("2d"),
    imageData: createImageData(canvasWidth, canvasHeight),
    grid: createGrid(width, height),
    cellsOnFire: new Set(),
    width,
    height,
    canvasWidth,
    canvasHeight,
    cellHeight: Math.max(1, Math.floor(canvasHeight / height)),
    cellWidth: Math.max(1, Math.floor(canvasWidth / width)),
  };

  await loadGridFromImg(drawingBoard, densityMap, densityMapping, "density");

  // Also calls 'drawCell' for each cell in the grid and 'putImageData'
  fillNoVeg(drawingBoard);
  return drawingBoard;
}

export async function loadImages(width: number, height: number, canvasWidth: number, canvasHeight: number, pixelThickness: number, withDensity: boolean = true) {
  const canvas = createCanvas(width, height);

  const drawingBoard: DrawingBoard = {
    ctx: canvas.getContext("2d"),
    imageData: createImageData(canvasWidth, canvasHeight),
    grid: createGrid(width, height),
    cellsOnFire: new Set(),
    width,
    height,
    canvasWidth,
    canvasHeight,
    cellHeight: Math.max(1, Math.floor(canvasHeight / height)),
    cellWidth: Math.max(1, Math.floor(canvasWidth / width)),
  };

  await loadGridFromImg(drawingBoard, vegMap, vegMapping, "vegBg", pixelThickness);
  await loadGridFromImg(drawingBoard, roadsMap, roadsMapping, "vegFg", pixelThickness);
  await loadGridFromImg(drawingBoard, waterlinesMap, waterMapping, "vegFg", pixelThickness);
  if (withDensity) await loadGridFromImg(drawingBoard, densityMap, densityMapping, "density");

  // Also calls 'drawCell' for each cell in the grid and 'putImageData'
  fillNoVeg(drawingBoard);
  return drawingBoard;
}
