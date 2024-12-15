import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import { loadImages } from "$lib/mapLoading";
import type { DrawingBoard } from "$lib/fireGrid";

export const GET: RequestHandler = async ({ url }) => {
  const width = Number(url.searchParams.get("width") ?? 800);
  const height = Number(url.searchParams.get("height") ?? 800);
  const canvasWidth = Number(url.searchParams.get("canvasWidth") ?? 800);
  const canvasHeight = Number(url.searchParams.get("canvasHeight") ?? 800);
  const pixelThickness = Number(url.searchParams.get("pixelThickness") ?? 1);

  const drawingBoard: DrawingBoard = await loadImages(width, height, canvasWidth, canvasHeight, pixelThickness);

  return json({
    grid: drawingBoard.grid,
    imageDataArray: Array.from(drawingBoard.imageData.data),
  });
}
