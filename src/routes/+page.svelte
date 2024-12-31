<script lang="ts">
	import { onMount } from 'svelte';
	import { createGrid, drawCell, baseProb, c1, c2, Vegetation } from '$lib/fireGrid';
	import type { DrawingBoard } from '$lib/fireGrid';
	import { setFire, simulate, type SimOptions, type SimResult } from '$lib/simulation';
	import { loadImages } from '$lib/mapLoading';
	import { getBurnPercentage, getBurntVegTypes, getFireCentre } from '$lib/results';
	import ResultsDisplay from './ResultsDisplay.svelte';
	import Experiment from './Experiment.svelte';

	let canvas: HTMLCanvasElement;
	let board: DrawingBoard;

	let ongoingExp: boolean = $state(false);
	let runs: SimResult[] = $state([]);

	let windSpeed = $state(0); // m/s
	let windDirDeg = $state(15);
	let windDir = $derived(degToRad(windDirDeg));

	let pixelThickness = $state(3);

	let height = $state(800);
	let width = $state(800);

	let canvasHeight = 800;
	let canvasWidth = 800;

	let cellHeight = 1;
	let cellWidth = 1;

	let dpr = 1;

	function degToRad(angle: number) {
		return (angle * Math.PI) / 180;
	}

	function resizeCanvas(event?: SubmitEvent) {
		event?.preventDefault();

		// Try to fit the canvas using the full height, and set the width
		// according the ratio
		const initialHeight = window.innerHeight;
		cellWidth = Math.ceil(((width / height) * initialHeight * dpr) / width);
		cellHeight = Math.ceil((initialHeight * dpr) / height);

		canvasWidth = width * cellWidth;
		canvas.width = canvasWidth;
		board.width = width;
		board.canvasWidth = canvasWidth;
		board.cellWidth = cellWidth;

		canvasHeight = height * cellHeight;
		canvas.height = canvasHeight;
		board.height = height;
		board.canvasHeight = canvasHeight;
		board.cellHeight = cellHeight;

		canvas.parentElement!.style.aspectRatio = `${width / height}`;
		console.table({ cellWidth, cellHeight, canvasWidth, canvasHeight, devicePixelRatio: dpr });
		resetCanvas();
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

	function resetCanvas() {
		board.imageData = board.ctx.createImageData(canvasWidth, canvasHeight);
		board.ctx.putImageData(board.imageData, 0, 0);
	}

	async function loadMaps() {
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
		ongoingExp = true;

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

		const simResult: SimResult = {
			nbSteps,
			burnPerc: getBurnPercentage(board),
			burnPercByVegType: getBurntVegTypes(board),
			fireCentre: getFireCentre(board)
		};
		runs.push(simResult);
		ongoingExp = false;
	}

	onMount(() => {
		const ctx = canvas.getContext('2d')!;
		ctx.imageSmoothingEnabled = false;

		updateDpr();

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

		resizeCanvas();

		// loadMaps();
		document.addEventListener('keydown', handleKeydown);

		return () => {
			document.removeEventListener('keydown', handleKeydown);
		};
	});

	function handleKeydown(e: KeyboardEvent) {
		if ((e.target as HTMLElement).tagName === 'INPUT' || ongoingExp) return;

		switch (e.code) {
			case 'KeyB':
				genFullForestGrid();
				break;
			case 'KeyC':
				loadMaps();
				break;
			case 'KeyR':
				resetCanvas();
				break;
			case 'KeyS':
				startSim();
				break;
		}
	}

	function updateDpr() {
		dpr = window.devicePixelRatio;
		const mql = matchMedia(`(resolution: ${dpr}dppx)`);
		mql.addEventListener('change', updateDpr, { once: true });
	}
</script>

<section class="fireGrid">
	<div class="canvasControls">
		<fieldset disabled={ongoingExp}>
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
			<fieldset disabled={ongoingExp}>
				<legend>Dimensions</legend>

				<label>
					Hauteur de la grille
					<input type="number" step={10} max={800} bind:value={height} />
				</label>

				<label>
					Largeur de la grille
					<input type="number" step={10} max={800} bind:value={width} />
				</label>

				<button>Redimensionner</button>
			</fieldset>
		</form>
	</div>

	<div class="canvasContainer" style="aspect-ratio: 1">
		<span class="windArrow" style={`transform: rotate(${-windDir}rad); translateX(-50%)`}
			>&#8594;</span
		>
		<!-- Set very high values to avoid layout shift when resizing -->
		<canvas bind:this={canvas} height={2000} width={2000}></canvas>

		{#if ongoingExp}
			<span class="simulationMsg">Simulation en cours...</span>
		{/if}
	</div>

	<div class="actions">
		<button disabled={ongoingExp} onclick={genFullForestGrid} style="color: forestgreen">
			Boiser (b)
		</button>
		<button disabled={ongoingExp} onclick={loadMaps} style="color: darkslateblue">
			Charger le terrain (c)
		</button>
		<button disabled={ongoingExp} onclick={resetCanvas} style="color: #414141">
			Réinitialiser (r)
		</button>
		<button
			disabled={ongoingExp}
			onclick={startSim}
			style="font-size: 1.1em; margin-top: 30px; color: darkcyan"
		>
			Simuler (s)
		</button>
	</div>
</section>

<h1>Résultats des expériences</h1>

<div class="experiments">
	<p>
		Vous visualiserez ici les résultats des expériences pré-enregistrées, ainsi que celles lancées
		interactivement via le tableau de bord.
	</p>

	<h2>Simulations interactives</h2>
	<p>Les résultats des simulations déclenchées depuis le tableau de bord apparaîtront ici.</p>

	{#if runs.length > 0}
		<ResultsDisplay {runs} labels={runs.map((_, i) => `Sim ${i + 1}`)} singleRow />
	{/if}

	<Experiment
		expNb={1}
		expTitle="Effet du vent"
		expDescription="Dans cette expérience, les simulations sont lancées avec des vitesses de vent croissantes, avec des valeurs allant de deux en deux."
		initialVal={0}
	/>
</div>

<style>
	.fireGrid {
		display: flex;
		justify-content: space-around;
		align-items: center;
		height: 100vh;
	}

	.windArrow {
		font-size: 3.5em;
		position: absolute;
		top: -1.2em;
		left: 50%;
	}

	.simulationMsg {
		position: absolute;
		font-size: 1.3em;
		bottom: -1.2em;
		left: 50%;
		transform: translateX(-50%);
	}

	.canvasContainer {
		box-sizing: border-box;
		display: flex;
		max-width: 70%;
		max-height: calc(100% - 4.2em * 2);
		padding: 10px;
		position: relative;

		canvas {
			border: 2px dashed #32b3aa;
			width: 100%;
			height: 100%;
		}
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

	h1 {
		text-align: center;
	}

	.experiments {
		width: 90%;
		margin: 50px auto;
		text-align: justify;
	}
</style>
