<script lang="ts">
	import { onMount } from 'svelte';
	import { createGrid, baseProb, c1, c2, Vegetation, vegWeights, fillNoVeg } from '$lib/fireGrid';
	import type { DrawingBoard } from '$lib/fireGrid';
	import { degToRad, setFire, simulate, type SimOptions, type SimResult } from '$lib/simulation';
	import { loadForestWithDensity, loadImages } from '$lib/mapLoading';
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

	let expBaseProb = $state(baseProb);
	let expC1 = $state(c1);
	let expC2 = $state(c2);
	let expVegWeights = $state(vegWeights);

	let pixelThickness = $state(1);
	let useDensity = $state(true);
	let placingFire = $state(false);
	let firePos = $state<[] | [number, number]>([]);

	let height = $state(800);
	let width = $state(800);

	let canvasHeight = 800;
	let canvasWidth = 800;

	let cellHeight = 1;
	let cellWidth = 1;

	let dpr = 1;

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

	async function genForestGrid() {
		if (useDensity) {
			const newBoard = await loadForestWithDensity(width, height, canvasWidth, canvasHeight);
			board.grid = newBoard.grid;
			board.imageData = newBoard.imageData;
		} else {
			board.grid = createGrid(width, height, Vegetation.Forests);
			fillNoVeg(board);
		}
		firePos = setFire(board);
	}

	function resetCanvas() {
		firePos = [];
		board.imageData = board.ctx.createImageData(canvasWidth, canvasHeight);
		board.ctx.putImageData(board.imageData, 0, 0);
	}

	async function loadMaps() {
		const newBoard = await loadImages(
			width,
			height,
			canvasWidth,
			canvasHeight,
			pixelThickness,
			useDensity
		);
		board.grid = newBoard.grid;
		board.imageData = newBoard.imageData;
		firePos = setFire(board);
	}

	function placeFire(event: MouseEvent) {
		if (!placingFire) return;

		const boundingRect = canvas.getBoundingClientRect();
		const scaleX = board.width / boundingRect.width;
		const scaleY = board.height / boundingRect.height;

		firePos = [
			Math.floor((event.clientY - boundingRect.top) * scaleY),
			Math.floor((event.clientX - boundingRect.left) * scaleX)
		];
		setFire(board, ...firePos);
		placingFire = false;
	}

	function toggleChooseFireLoc() {
		placingFire = !placingFire;
	}

	async function startSim() {
		ongoingExp = true;

		const options: SimOptions = {
			drawEachStep: true,
			stepInterval: 5,
			baseProb: expBaseProb,
			windSpeed,
			windDir,
			c1: expC1,
			c2: expC2,
			vegWeights: $state.snapshot(expVegWeights)
		};
		const { elapsed, nbSteps } = await simulate(board, options);
		console.log(`Simulation finished in ${elapsed / 1000} seconds and ${nbSteps} steps.`);

		const simResult: SimResult = {
			nbSteps,
			burnPerc: getBurnPercentage(board),
			burnPercByVegType: getBurntVegTypes(board),
			fireCentre: getFireCentre(board)
		};
		runs.push(simResult);
		firePos = [];
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
		if (placingFire && e.code !== 'KeyF') return;

		switch (e.code) {
			case 'KeyB':
				genForestGrid();
				break;
			case 'KeyC':
				loadMaps();
				break;
			case 'KeyF':
				toggleChooseFireLoc();
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
	<div class="controls">
		<fieldset disabled={ongoingExp}>
			<legend>Constantes</legend>

			<label>
				Probabilité de base
				<input type="number" step="any" bind:value={expBaseProb} />
			</label>

			<div class="inline">
				<label>
					C1
					<input type="number" step="any" bind:value={expC1} />
				</label>

				<label>
					C2
					<input type="number" step="any" bind:value={expC2} />
				</label>
			</div>
		</fieldset>

		<fieldset disabled={ongoingExp}>
			<legend>Poids attribués</legend>

			<div class="inline">
				<label>
					Désert
					<input type="number" step="any" bind:value={expVegWeights[Vegetation.NoVeg]} />
				</label>

				<label>
					Agriculture
					<input type="number" step="any" bind:value={expVegWeights[Vegetation.Agriculture]} />
				</label>
			</div>

			<div class="inline">
				<label>
					Forêt
					<input type="number" step="any" bind:value={expVegWeights[Vegetation.Forests]} />
				</label>

				<label>
					Arbustaie
					<input type="number" step="any" bind:value={expVegWeights[Vegetation.Shrublands]} />
				</label>
			</div>

			<div class="inline">
				<label>
					Route 1
					<input type="number" step="any" bind:value={expVegWeights[Vegetation.PrimaryRoad]} />
				</label>

				<label>
					Route 2
					<input type="number" step="any" bind:value={expVegWeights[Vegetation.SecondaryRoad]} />
				</label>
			</div>

			<div class="inline">
				<label>
					Route 3
					<input type="number" step="any" bind:value={expVegWeights[Vegetation.TertiaryRoad]} />
				</label>

				<label>
					Eau
					<input type="number" step="any" bind:value={expVegWeights[Vegetation.Waterline]} />
				</label>
			</div>
		</fieldset>

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
		</fieldset>
	</div>

	<div class="canvasContainer" style="aspect-ratio: 1">
		<span class="windArrow" style={`transform: rotate(${-windDir}rad); translateX(-50%)`}
			>&#8594;</span
		>
		<!-- Set very high values to avoid layout shift when resizing -->
		<canvas bind:this={canvas} height={2000} width={2000} onclick={placeFire}></canvas>

		{#if ongoingExp}
			<span class="msg">Simulation en cours...</span>
		{/if}

		{#if placingFire}
			<span class="msg">Cliquer sur la grille</span>
		{/if}
	</div>

	<div class="controls">
		<button
			disabled={ongoingExp || placingFire}
			onclick={startSim}
			class="simBtn"
			style="width: 100%; font-size: 1.1em; font-weight: bold; color: darkcyan"
		>
			Simuler (s)
		</button>

		<fieldset disabled={ongoingExp}>
			<legend>Carte</legend>

			<label>
				Emplacement du feu

				<div class="inline">
					<input type="number" min={0} max={height} bind:value={firePos[0]} />
					<input type="number" min={0} max={height} bind:value={firePos[1]} />
					<button onclick={toggleChooseFireLoc} style="margin: 0">
						{#if !placingFire}Choisir{:else}Annuler{/if}
					</button>
				</div>
			</label>

			<label>
				Épaisseur des traits
				<input type="number" min={1} max={30} bind:value={pixelThickness} />
			</label>

			<label>
				Inclure la densité
				<input type="checkbox" bind:checked={useDensity} />
			</label>

			<button disabled={placingFire} onclick={genForestGrid} style="color: forestgreen">
				Boiser (b)
			</button>

			<button disabled={placingFire} onclick={resetCanvas} style="color: #414141">
				Réinitialiser (r)
			</button>

			<button disabled={placingFire} onclick={loadMaps} style="color: darkslateblue">
				Charger le terrain (c)
			</button>
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
		expTitle="Effet de la vitesse du vent"
		expDescription="Dans cette expérience, les simulations sont lancées avec des vitesses de vent croissantes, avec des valeurs allant de deux en deux."
		initialVal={0}
	/>

	<Experiment
		expNb={2}
		expTitle="Effet de la direction du vent - terrain homogène"
		expDescription="La direction du vent joue un rôle crucial dans la propagation du feu. Il est néanmoins important de contrôler qu'elle n'a pas d'influence dans un milieu où la végétation est homogène."
		initialVal={0}
	/>

	<Experiment
		expNb={3}
		expTitle="Effet de la direction du vent - terrain quelconque"
		expDescription="On teste maintenant les caractéristiques d'un terrain particulier, afin de connaître les directions privilégiées de propagation du feu."
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

	.msg {
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

	.controls {
		width: 20%;
		margin: auto 10px;

		.inline {
			display: flex;
			gap: 10px;
			margin: 15px 0;

			label {
				flex: 1 1 0;
				margin: 0;
			}
		}

		fieldset {
			padding-top: 0;
			padding-bottom: 0;
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

		input[type='checkbox'] {
			width: 1.3em;
			height: 1.3em;
			vertical-align: middle;
			margin: 0 0.5em;
		}

		button {
			display: block;
			margin: 15px auto;
			padding: 5px 8px;
		}
	}

	h1 {
		text-align: center;
	}

	.experiments {
		width: 90%;
		margin: 0 auto;
		text-align: justify;
	}
</style>
