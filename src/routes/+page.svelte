<script lang="ts">
	import { onMount } from 'svelte';
	import { createGrid, drawCell, baseProb, c1, c2, Vegetation } from '$lib/fireGrid';
	import type { DrawingBoard } from '$lib/fireGrid';
	import {
		setFire,
		simulate,
		type ExpResults,
		type SimOptions,
		type SimResult
	} from '$lib/simulation';
	import { loadImages } from '$lib/mapLoading';
	import { getBurnPercentage, getBurntVegTypes, getFireCentre } from '$lib/results';
	import ResultsDisplay from './ResultsDisplay.svelte';

	let canvas: HTMLCanvasElement;
	let board: DrawingBoard;

	let ongoingSim = $state(false);
	let simResults: ExpResults[] = $state([]);
	let interactiveSims: SimResult[] = $state([]);

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
		ongoingSim = true;

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
		interactiveSims.push(simResult);
		console.log($state.snapshot(interactiveSims));

		ongoingSim = false;
	}

	async function fetchExpResults(expNb: number) {
		const response = await fetch(`/api/simulate/?expNb=${expNb}`);
		const result: ExpResults = await response.json();
		simResults.push(result);
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
		if ((e.target as HTMLElement).tagName === 'INPUT') return;

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
			case 'Digit1':
				fetchExpResults(1);
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
		<fieldset disabled={ongoingSim}>
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
			<fieldset disabled={ongoingSim}>
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

		{#if ongoingSim}
			<span class="simulationMsg">Simulation en cours...</span>
		{/if}
	</div>

	<div class="actions">
		<button disabled={ongoingSim} onclick={genFullForestGrid} style="color: forestgreen"
			>Boiser (b)</button
		>
		<button disabled={ongoingSim} onclick={loadMaps} style="color: darkslateblue"
			>Charger le terrain (c)</button
		>
		<button disabled={ongoingSim} onclick={resetCanvas} style="color: #414141"
			>Réinitialiser (r)</button
		>
		<button
			disabled={ongoingSim}
			onclick={startSim}
			style="font-size: 1.1em; margin-top: 30px; color: darkcyan">Simuler (s)</button
		>
		<button
			disabled={ongoingSim}
			onclick={() => fetchExpResults(1)}
			style="font-size: 1.1em; margin-top: 30px; color: mediumpurple">Expérience 1</button
		>
	</div>
</section>

<h1>Résultats des expériences</h1>

<div class="allResults">
	{#if simResults.length === 0 && interactiveSims.length === 0}
		<p>
			Vous visualiserez ici les résultats des expériences pré-enregistrées, ainsi que celles lancées
			interactivement via le tableau de bord.
		</p>
	{:else}
		{#if interactiveSims.length > 0}
			<ResultsDisplay
				expTitle="Simulations interactives"
				expDescription="Les résultats des simulations déclenchées depuis le tableau de bord apparaissent ici."
				runs={interactiveSims}
				singleRow
			/>
		{/if}

		{#each simResults as results}
			<ResultsDisplay {...results} />
		{/each}
	{/if}
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

	.allResults {
		width: 90%;
		margin: 50px auto;
		text-align: justify;
	}
</style>
