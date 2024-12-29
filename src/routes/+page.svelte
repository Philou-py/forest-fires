<script lang="ts">
	// import type { PageData } from "./$types";
	import { onMount } from 'svelte';
	import {
		createGrid,
		vegWeights,
		densityWeights,
		drawCell,
		MAX_BURN,
		baseProb,
		c1,
		c2,
		Vegetation
	} from '$lib/fireGrid';
	import type { DrawingBoard } from '$lib/fireGrid';
	import { setFire, sim1, simulate, type SimOptions } from '$lib/simulation';
	import { loadImages } from '$lib/mapLoading';
	import { getFireCentre } from '$lib/results';

	// let { data }: { data: PageData } = $props();

	let canvas: HTMLCanvasElement;
	let board: DrawingBoard;

	let ongoingSimulation = $state(false);

	let windSpeed = $state(0); // m/s
	let windDirDeg = $state(15);
	let windDir = $derived(degToRad(windDirDeg));

	let pixelThickness = $state(3);

	let height = $state(800);
	let width = $state(800);

	let canvasHeight = $state(800);
	let canvasWidth = $state(800);

	let cellHeight = $derived(Math.max(1, Math.floor(canvasHeight / height)));
	let cellWidth = $derived(Math.max(1, Math.floor(canvasWidth / width)));

	function degToRad(angle: number) {
		return (angle * Math.PI) / 180;
	}

	function resizeCanvas(event: SubmitEvent) {
		event.preventDefault();

		canvasHeight = height * cellHeight;
		canvas.height = canvasHeight;
		board.height = height;
		board.canvasHeight = canvasHeight;
		board.cellHeight = cellHeight;

		canvasWidth = width * cellWidth;
		canvas.width = canvasWidth;
		board.width = width;
		board.canvasWidth = canvasWidth;
		board.cellWidth = cellWidth;

		resetDrawGrid();
	}

	function drawGrid() {
		for (let row = 0; row < height; row++) {
			for (let col = 0; col < width; col++) {
				drawCell(board, row, col);
			}
		}
		board.ctx.putImageData(board.imageData, 0, 0);
	}

	function genFullForestGrid() {
		board.grid = createGrid(width, height, Vegetation.Forests);
		setFire(board);
		drawGrid();
	}

	function resetGrid() {
		board.imageData = board.ctx.createImageData(canvasWidth, canvasHeight);
		board.grid = createGrid(width, height);
	}

	function resetDrawGrid() {
		resetGrid();
		drawGrid();
	}

	async function loadMaps() {
		resetGrid();
		// const searchParams = new URLSearchParams();
		// searchParams.set("width", width.toString());
		// searchParams.set("height", height.toString());
		// searchParams.set("canvasWidth", canvasWidth.toString());
		// searchParams.set("height", height.toString());
		// searchParams.set("canvasHeight", canvasHeight.toString());
		// searchParams.set("pixelThickness", pixelThickness.toString());

		// const response = await fetch(`/api/load-maps?${searchParams}`)
		// const result = await response.json();
		// const arr = new Uint8ClampedArray(result.imageDataArray);

		// board.imageData = new ImageData(arr, canvasWidth, canvasHeight);
		// board.grid = result.grid;

		const newBoard = await loadImages(width, height, canvasWidth, canvasHeight, pixelThickness);
		board.grid = newBoard.grid;
		board.imageData = newBoard.imageData;
		setFire(board);
	}

	async function startSim() {
		ongoingSimulation = true;

		const options: SimOptions = {
			drawEachStep: true,
			stepInterval: 5,
			baseProb,
			windSpeed,
			windDir,
			c1,
			c2
		};
		const { elapsed, nbSteps } = await simulate(board, options);
		console.log(`Simulation finished in ${elapsed / 1000} seconds and ${nbSteps} steps.`);
		console.log('Fire centre:', getFireCentre(board));

		ongoingSimulation = false;
	}

	onMount(() => {
		const ctx = canvas.getContext('2d')!;
		ctx.imageSmoothingEnabled = false;

		board = {
			// @ts-ignore
			ctx,
			imageData: ctx.createImageData(canvasWidth, canvasHeight),
			grid: createGrid(width, height),
			cellsOnFire: new Set(),
			width,
			height,
			canvasWidth,
			canvasHeight,
			cellWidth,
			cellHeight
		};

		// loadMaps();
		document.addEventListener('keydown', handleKeydown);

		return () => {
			document.removeEventListener('keydown', handleKeydown);
		};
	});

	function handleKeydown(e: KeyboardEvent) {
		if ((e.target as HTMLElement).tagName === 'INPUT') return;
		
		switch (e.code) {
			case 'KeyB':
				genFullForestGrid();
				break;
			case 'KeyC':
				loadMaps();
				break;
			case 'KeyR':
				resetDrawGrid();
				break;
			case 'KeyS':
				startSim();
				break;
			case 'Digit1':
				sim1();
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
	</div>

	<div class="actions">
		<button onclick={genFullForestGrid} style="color: forestgreen">Boiser</button>
		<button onclick={loadMaps} style="color: darkorange">Charger le terrain</button>
		<button onclick={resetDrawGrid} style="color: #414141">Réinitialiser</button>
		<button onclick={startSim} style="font-size: 1.3em; margin-top: 30px; color: darkcyan"
			>Simuler</button
		>
		<button onclick={sim1} style="font-size: 1.3em; margin-top: 30px; color: darkgoldenrod"
			>Simulation 1</button
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
