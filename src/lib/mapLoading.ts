import { createCanvas, createImageData, loadImage } from "canvas";
import type { DrawingBoard, VegType, ColType } from "$lib/fireGrid";
import { createGrid, drawSquare, fillNoVeg, Vegetation } from "$lib/fireGrid";
import vegMap from "./maps/vegetation-map.png";
import roadsMap from "./maps/roads-map.png";
import waterlinesMap from "./maps/waterlines-map.png";
// import { createWriteStream } from "fs";

export type ColourMapping = [ColType, VegType][];

export const roadsMapping: ColourMapping = [
  [[255, 0, 0, 255], Vegetation.PrimaryRoad],
  [[255, 208, 26, 255], Vegetation.SecondaryRoad],
  [[62, 255, 62, 255], Vegetation.TertiaryRoad]
];

export const vegMapping: ColourMapping = [
  [[255, 229, 0, 255], Vegetation.Forests],
  [[255, 101, 0, 255], Vegetation.Shrublands],
  [[170, 0, 0, 255], Vegetation.Agriculture]
];

export const waterMapping: ColourMapping = [[[6, 200, 255, 255], Vegetation.Waterline]];

// Weighted Euclidian distance between two colours normalized between 0 and 1
// 65025 is the distance between black and white
function colourDist([r1, g1, b1]: readonly number[], [r2, g2, b2]: readonly number[]) {
  return (0.3 * (r1 - r2) ** 2 + 0.59 * (g1 - g2) ** 2 + 0.11 * (b1 - b2) ** 2) / 65025;
}

function loadGridFromImg(board: DrawingBoard, url: string, mapping: ColourMapping, pixelThickness: number) {
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
        const [closestVeg, dist] = mapping.reduce(
          ([minVeg, minDist], [col, veg]) => {
            const dist = colourDist(pixelCol, col);
            return dist < minDist ? [veg, dist] : [minVeg, minDist];
          },
          [mapping[0][1], 1]
        );

        if (dist < 0.03) {
          drawSquare(board, row, col, closestVeg, pixelThickness);
        }

        if (col == board.width - 1) {
          row++;
          col = 0;
        } else {
          col++;
        }
      }

      resolve(true);
    });
  });
}


export async function loadImages(width: number, height: number, canvasWidth: number, canvasHeight: number, pixelThickness: number) {
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

  await loadGridFromImg(drawingBoard, vegMap, vegMapping, pixelThickness);
  await loadGridFromImg(drawingBoard, roadsMap, roadsMapping, pixelThickness);
  await loadGridFromImg(drawingBoard, waterlinesMap, waterMapping, pixelThickness);
  fillNoVeg(drawingBoard);

  // const out = createWriteStream('./test.png')
  // const stream = canvas.createPNGStream()
  // stream.pipe(out)
  // out.on('finish', () => console.log('The PNG file was created.'))
  return drawingBoard;
}
