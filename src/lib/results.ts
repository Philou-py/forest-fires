import type { DrawingBoard } from "$lib/fireGrid";

export function countBurntTrees(board: DrawingBoard) {
	let burntCount = 0;
	for (let row = 0; row < board.height; row++) {
		for (let col = 0; col < board.width; col++) {
			if (board.grid[row][col].burnDegree > 0) burntCount++;
		}
	}
	return burntCount;
}

