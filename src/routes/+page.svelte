<script lang="ts">
	import { onMount } from 'svelte';
	import vegMap from '$lib/maps/vegetation-map.png';
	import roadsMap from '$lib/maps/roads-map.png';
	import waterlinesMap from '$lib/maps/waterlines-map.png';

	let canvas: HTMLCanvasElement;
	let imgCanvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;
	let imgCtx: CanvasRenderingContext2D;

	const Vegetation = {
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
	type VegType = (typeof Vegetation)[keyof typeof Vegetation];

	// const vegWeights = {
	// 	[Vegetation.NoVeg]: -1,
	// 	[Vegetation.Agriculture]: -0.4,
	// 	[Vegetation.Forests]: 0.4,
	// 	[Vegetation.Shrublands]: 0.4,
	// 	[Vegetation.PrimaryRoad]: -0.8,
	// 	[Vegetation.SecondaryRoad]: -0.7,
	// 	[Vegetation.TertiaryRoad]: -0.4,
	// 	[Vegetation.Waterline]: -0.4
	// } as const;

	const vegWeights = {
		[Vegetation.NoVeg]: -1,
		[Vegetation.Agriculture]: -0.7,
		[Vegetation.Forests]: 0.4,
		[Vegetation.Shrublands]: 0.4,
		[Vegetation.PrimaryRoad]: -1.2,
		[Vegetation.SecondaryRoad]: -0.9,
		[Vegetation.TertiaryRoad]: -0.7,
		[Vegetation.Waterline]: -1.0
	} as const;

	const Density = {
		NoVeg: 0,
		Sparse: 1,
		Normal: 2,
		Dense: 3,
		PrimaryRoad: 4,
		SecondaryRoad: 5,
		TertiaryRoad: 6,
		Waterline: 7
	} as const;
	type DensityType = (typeof Density)[keyof typeof Density];

	const densityWeights = {
		[Density.NoVeg]: -1,
		[Density.Sparse]: -0.3,
		[Density.Normal]: 0,
		[Density.Dense]: 0.3,
		[Density.PrimaryRoad]: -0.8,
		[Density.SecondaryRoad]: -0.7,
		[Density.TertiaryRoad]: -0.4,
		[Density.Waterline]: -0.4
	} as const;

	type Cell = {
		veg: VegType;
		density: DensityType;
		burnDegree: 0 | 1 | 2 | 3;
	};
	const MAX_BURN = 3;

	const baseProb = 0.58; // 0.58 is the recommended value
	const c1 = 0.045;
	const c2 = 0.131;

	let windSpeed = $state(0); // m/s
	let windDirDeg = $state(15);
	let windDir = $derived(degToRad(windDirDeg));

	let pixelThickness = $state(3);

	// Colour values are given as [R, G, B, A]
	const Colours = {
		[Vegetation.NoVeg]: [255, 255, 255, 255], // [146, 147, 147, 255] #929393 (concrete)
		[Vegetation.Forests]: [230, 255, 219, 255], // light green
		[Vegetation.Shrublands]: [229, 244, 118, 255], // yellow-green
		[Vegetation.Agriculture]: [255, 219, 250, 255], // light pink
		[Vegetation.PrimaryRoad]: [129, 104, 253, 255], // purple
		[Vegetation.SecondaryRoad]: [255, 208, 26, 255], // yellow
		[Vegetation.TertiaryRoad]: [62, 255, 62, 255], // bright green
		[Vegetation.Waterline]: [79, 172, 243, 255] // medium blue
	} as const;
	type ColType = [number, number, number, number];

	type ColourMapping = [ColType, VegType][];

	const roadsMapping: ColourMapping = [
		[[255, 0, 0, 255], Vegetation.PrimaryRoad],
		[[255, 208, 26, 255], Vegetation.SecondaryRoad],
		[[62, 255, 62, 255], Vegetation.TertiaryRoad]
	];

	const vegMapping: ColourMapping = [
		[[255, 229, 0, 255], Vegetation.Forests],
		[[255, 101, 0, 255], Vegetation.Shrublands],
		[[170, 0, 0, 255], Vegetation.Agriculture]
	];

	const waterMapping: ColourMapping = [[[6, 200, 255, 255], Vegetation.Waterline]];

	const FireColours = [
		[255, 87, 34, 255],
		[221, 44, 0, 255],
		[191, 54, 12, 255]
	]; // ['#FF5722', '#DD2C00', '#BF360C']

	let grid: Cell[][];
	let imageData: ImageData;
	let ongoingSimulation = $state(false);

	let height = $state(800);
	let width = $state(800);

	let canvasHeight = $state(800);
	let canvasWidth = $state(800);

	let cellHeight = $derived(Math.max(1, Math.floor(canvasHeight / height)));
	let cellWidth = $derived(Math.max(1, Math.floor(canvasWidth / width)));

	let fourCellWidth = $derived(4 * cellWidth);
	let fourCanvasWidth = $derived(4 * canvasWidth);

	// This list contains the relative position in the grid of neighbouring squares,
	// as well as the angle of the wind from a neighbour towards the center.
	const NEIGHBOURS = [
		[-1, -1, Math.PI + (3 * Math.PI) / 4],
		[-1, 0, Math.PI + Math.PI / 2],
		[-1, 1, Math.PI + Math.PI / 4],
		[0, 1, Math.PI + 0],
		[1, 1, Math.PI + -Math.PI / 4],
		[1, 0, Math.PI + -Math.PI / 2],
		[1, -1, Math.PI + (-3 * Math.PI) / 4],
		[0, -1, Math.PI + Math.PI]
	];

	function degToRad(angle: number) {
		return (angle * Math.PI) / 180;
	}

	// updateCell returns whether an change was made
	function updateCell(oldGrid: Cell[][], row: number, col: number): boolean {
		// The type of a cell never changes
		const cell = grid[row][col];
		const oldCell = oldGrid[row][col];

		if (oldCell.burnDegree == 0) {
			// let prob = 1;

			for (const [rowOffset, colOffset, angle] of NEIGHBOURS) {
				const neighRow = row + rowOffset;
				const neighCol = col + colOffset;

				if (neighRow < 0 || neighRow >= height || neighCol < 0 || neighCol >= width) continue;

				let neighCell = oldGrid[neighRow][neighCol];
				// If neighCell is currently burning
				if (neighCell.burnDegree > 0 && neighCell.burnDegree < MAX_BURN) {
					const windEffect = Math.exp(windSpeed * (c1 + c2 * (Math.cos(windDir - angle) - 1)));
					const slopeEffect = 1;

					let prob =
						baseProb *
						(1 + vegWeights[oldCell.veg]) *
						(1 + densityWeights[oldCell.density]) *
						windEffect *
						slopeEffect;

					if (prob > Math.random()) {
						cell.burnDegree = 1;
						return true;
					}
				}
			}
			// prob = 1 - prob;
		} else if (oldCell.burnDegree < MAX_BURN) {
			cell.burnDegree++;
			return true;
		}

		cell.burnDegree = oldCell.burnDegree;
		return false;
	}

	function createGrid(initialVeg?: VegType, initialDensity?: DensityType) {
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

	function sleep(millis: number) {
		return new Promise((resolve) => setTimeout(resolve, millis));
	}

	function resizeCanvas(event: SubmitEvent) {
		event.preventDefault();

		canvasHeight = height * cellHeight;
		canvas.height = canvasHeight;

		canvasWidth = width * cellWidth;
		canvas.width = canvasWidth;

		resetDrawGrid();
	}

	function drawCell(row: number, col: number) {
		const cell = grid[row][col];
		const colour = cell.burnDegree == 0 ? Colours[cell.veg] : FireColours[cell.burnDegree - 1];

		// 'imageData.data' is a flattened array storing each pixel as 4 colour components (R, G, B, A)
		const baseIndex = row * fourCanvasWidth * cellHeight + col * fourCellWidth;
		const endIndex = baseIndex + fourCanvasWidth * cellHeight;
		for (let i = baseIndex; i < endIndex; i += fourCanvasWidth) {
			for (let j = 0; j < fourCellWidth; j += 4) {
				imageData.data.set(colour, i + j);
			}
		}
	}

	function drawGrid() {
		for (let row = 0; row < height; row++) {
			for (let col = 0; col < width; col++) {
				drawCell(row, col);
			}
		}
		ctx.putImageData(imageData, 0, 0);
	}

	async function simulate() {
		ongoingSimulation = true;

		// Read from the old grid, write in the new one
		let oldGrid = structuredClone(grid);
		let gridChange = true;

		while (gridChange) {
			gridChange = false;
			// Swap the current grid with the old one
			const swapTmp = grid;
			grid = oldGrid;
			oldGrid = swapTmp;

			for (let row = 0; row < height; row++) {
				for (let col = 0; col < width; col++) {
					const changed = updateCell(oldGrid, row, col);

					if (changed) {
						if (!gridChange) gridChange = true;
						drawCell(row, col);
					}
				}
			}
			ctx.putImageData(imageData, 0, 0);
			await sleep(5);
		}

		// ctx.putImageData(imageData, 0, 0);
		ongoingSimulation = false;
	}

	function genFullForestGrid() {
		grid = createGrid(Vegetation.Forests);
		grid[height / 2][width / 2].burnDegree = 1;
		drawGrid();
	}

	function resetGrid() {
		imageData = ctx.createImageData(canvasWidth, canvasHeight);
		grid = createGrid();
	}

	function resetDrawGrid() {
		resetGrid();
		drawGrid();
	}

	// Fill the grid with forests on the squares where no vegetation is present
	function fillNoVeg() {
		for (let row = 0; row < height; row++) {
			for (let col = 0; col < width; col++) {
				if (grid[row][col].veg == Vegetation.NoVeg) {
					grid[row][col].veg = Vegetation.Forests;
					drawCell(row, col);
				}
			}
		}
		ctx.putImageData(imageData, 0, 0);
	}

	async function getImageData(url: string) {
		const img = new Image();
		img.src = url;
		await img.decode();
		imgCtx.drawImage(img, 0, 0, width, height);
		return imgCtx.getImageData(0, 0, width, height).data;
	}

	// Weighted Euclidian distance between two colours normalized between 0 and 1
	// 65025 is the distance between black and white
	function colourDist([r1, g1, b1]: readonly number[], [r2, g2, b2]: readonly number[]) {
		return (0.3 * (r1 - r2) ** 2 + 0.59 * (g1 - g2) ** 2 + 0.11 * (b1 - b2) ** 2) / 65025;
	}

	// Thickness represents the upper integer part of half the height (or width) of the square that is to be drawn
	function drawSquare(row: number, col: number, veg: VegType, thickness: number) {
		const startRow = Math.max(0, row - thickness + 1);
		const endRow = Math.min(height, row + thickness);
		const startCol = Math.max(0, col - thickness + 1);
		const endCol = Math.min(width, col + thickness);

		for (let i = startRow; i < endRow; i++) {
			for (let j = startCol; j < endCol; j++) {
				grid[i][j] = {
					veg,
					density: Density.Normal,
					burnDegree: 0
				};
				drawCell(i, j);
			}
		}
	}

	async function loadGridFromImg(url: string, mapping: ColourMapping) {
		const loadedData = await getImageData(url);

		// To avoid overlap
		// const step = 2 * pixelThickness - 1;

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
				drawSquare(row, col, closestVeg, pixelThickness);
			}

			// To avoid overlap:
			// if (col + step >= width) {
			if (col == width - 1) {
				row++;
				col = 0;

				// To avoid overlap:
				// // Skip the remaining pixels on this row
				// i += fourCellWidth * (width - col);
				// col = 0;

				// // Skip rows
				// i += fourCanvasWidth * (step - 1);
				// row += step;
			} else {
				col++;

				// To avoid overlap:
				// i += fourCellWidth * step;
				// col += step;
			}
		}

		ctx.putImageData(imageData, 0, 0);
	}

	async function loadImages() {
		resetGrid();
		await loadGridFromImg(vegMap, vegMapping);
		await loadGridFromImg(roadsMap, roadsMapping);
		await loadGridFromImg(waterlinesMap, waterMapping);
		fillNoVeg();
		grid[height / 2][width / 2].burnDegree = 1;
		drawCell(height / 2, width / 2);
		ctx.putImageData(imageData, 0, 0);
	}

	onMount(() => {
		ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
		imgCtx = imgCanvas.getContext('2d') as CanvasRenderingContext2D;
		resetGrid();
		loadImages();
		document.addEventListener('keydown', handleKeydown);
	});

	function handleKeydown(e: KeyboardEvent) {
		switch (e.code) {
			case 'KeyB':
				genFullForestGrid();
				break;
			case 'KeyC':
				loadImages();
				break;
			case 'KeyR':
				resetDrawGrid();
				break;
			case 'KeyS':
				simulate();
				break;
		}
	}
</script>

<section class="fireGrid">
	<div class="canvasControls">
		<fieldset disabled={ongoingSimulation}>
			<legend>Paramètres</legend>

			<label>
				Vitesse du vent (m/s)
				<input type="number" min={0} bind:value={windSpeed} />
			</label>

			<label>
				Direction du vent (deg)
				<input type="number" min={0} max={359} bind:value={windDirDeg} />
			</label>

			<label>
				Épaisseur des pixels
				<input type="number" min={1} max={30} bind:value={pixelThickness} />
			</label>
		</fieldset>

		<form onsubmit={resizeCanvas}>
			<fieldset disabled={ongoingSimulation}>
				<legend>Dimensions</legend>

				<label>
					Hauteur de la grille
					<input type="number" step={50} max={800} bind:value={height} />
				</label>

				<label>
					Largeur de la grille
					<input type="number" step={50} max={800} bind:value={width} />
				</label>

				<label>
					Hauteur du canvas
					<input type="number" step={50} max={800} bind:value={canvasHeight} />
				</label>

				<label>
					Largeur du canvas
					<input type="number" step={50} max={800} bind:value={canvasWidth} />
				</label>

				<button>Redimensionner</button>
			</fieldset>
		</form>
	</div>

	<div class="canvases">
		<span class="windArrow" style={`transform: rotate(${-windDir}rad); translateX(-50%)`}
			>&#8594;</span
		>
		<canvas class="mainCanvas" bind:this={canvas} height={800} width={800}></canvas>

		{#if ongoingSimulation}
			<span class="simulationMsg">Simulation en cours...</span>
		{/if}

		<canvas bind:this={imgCanvas} height={800} width={800} style="display: none"></canvas>
	</div>

	<div class="actions">
		<button onclick={genFullForestGrid} style="color: forestgreen">Boiser</button>
		<button onclick={loadImages} style="color: darkorange">Charger le terrain</button>
		<button onclick={resetDrawGrid} style="color: #414141">Réinitialiser</button>
		<button onclick={simulate} style="font-size: 1.3em; margin-top: 30px; color: darkcyan"
			>Simuler</button
		>
	</div>
</section>

<style>
	:global(body) {
		margin: 0;
		font-family: cursive;
	}

	:global(input) {
		font-family: inherit;
		font-size: 0.9em;
	}

	:global(button) {
		font-family: inherit;
		font-size: 1.1em;
	}

	.fireGrid {
		display: flex;
		justify-content: space-around;
		align-items: center;
		height: 100vh;
	}

	.windArrow {
		font-size: 3.5em;
		position: absolute;
		top: 10px;
		left: 50%;
	}

	.simulationMsg {
		position: absolute;
		font-size: 1.5em;
		bottom: 20px;
		left: 50%;
		transform: translateX(-50%);
	}

	.canvases {
		box-sizing: border-box;
		display: flex;
		height: 100%;
		padding: 10px;
		margin: auto 0;
		justify-content: center;
		align-items: center;
		position: relative;
	}

	canvas {
		border: 2px dashed #32b3aa;
	}

	button {
		display: block;
		padding: 5px 8px;
	}

	.canvasControls {
		width: 20%;
		margin: auto 10px;

		fieldset {
			margin: 1em 0;
		}

		label {
			display: block;
			text-align: center;
			margin: 15px 0;
		}

		input {
			box-sizing: border-box;
			width: 100%;
			margin: 5px 0;
		}

		button {
			margin: 0 auto;
		}
	}

	.actions {
		width: 20%;
		margin: auto 10px;

		button {
			margin: 15px auto;
		}
	}
</style>
