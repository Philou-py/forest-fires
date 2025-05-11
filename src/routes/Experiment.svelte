<script lang="ts">
	import ResultsDisplay from './ResultsDisplay.svelte';
	import type { ExpConfig, ExpResults, SimResult } from '$lib/simulation';
	import { tick } from 'svelte';
	import { slide } from 'svelte/transition';
	import { getGreatestGap, getSteepest, mergeRuns, smoothData } from '$lib/results';
	import { Vegetation } from '$lib/fireGrid';

	interface Props {
		expTitle: string;
		expDescription: string;
		initialConfig: ExpConfig;
		compactDisp?: boolean;
	}

	let { expTitle, expDescription, initialConfig, compactDisp }: Props = $props();

	let resultsDiv: HTMLDivElement;

	let ongoingExp = $state(false);
	let repeatedExp = $state(false);
	let runs: SimResult[] = $state([]);
	let labels: string[] = $state([]);
	let config: ExpConfig = $state(initialConfig);
	let shouldSmooth = $state(true);

	let slopes = $state({
		// For each vegetation type, store its name, the label of the point with the steepest slope
		// and the value of the steepest slope
		byVegType: [...Array(7)].map(() => ['', '', -1]) as [string, string, number][],
		burntArea: ['', -1] as [string, number],
		stepNb: ['', -1] as [string, number],
		fireCentre: ['', -1] as [string, number],
		upToDate: true
	});

	async function repeatExp() {
		ongoingExp = true;
		slopes.upToDate = false;
		config.nbReps ??= 1;

		const repeatConfig = {
			...config,
			startVal: config.min,
			nbIters: runs.length,
			nbReps: 1
		};

		const response = await fetch(`/api/simulate/`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(repeatConfig)
		});
		const results: ExpResults = await response.json();

		repeatedExp = true;
		mergeRuns(runs, config.nbReps, results.runs);
		config.nbReps++;

		ongoingExp = false;
	}

	async function fetchExpResults() {
		ongoingExp = true;
		slopes.upToDate = false;
		repeatedExp = false;

		const response = await fetch(`/api/simulate/`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(config)
		});
		const results: ExpResults = await response.json();

		runs.push(...results.runs);
		labels.push(...results.labels);
		config.startVal = results.nextExp;

		ongoingExp = false;
		await tick();
		resultsDiv.scrollIntoView();
	}

	async function analyseResults() {
		// Force update of the data series
		repeatedExp = true;
		const samplingWidth = shouldSmooth ? Math.floor(runs.length / 10) : 0;

		Object.keys(Vegetation)
			.slice(1)
			.forEach((vegName) => {
				const vegIndex = Vegetation[vegName as keyof typeof Vegetation] - 1;
				slopes.byVegType[vegIndex] = [vegName, '', NaN];
				// If this vegetation type did not appear on the map of the experiment
				if (runs.length > 0 && runs[0].burnPercByVegType[vegIndex][2] === null) return;

				const smoothed = smoothData(
					runs.map((run) => run.burnPercByVegType[vegIndex][2]!),
					samplingWidth
				);
				smoothed.forEach((perc, i) => (runs[i].burnPercByVegType[vegIndex][2] = perc));

				const [steepestIndex, maxSlope] = getSteepest(smoothed);

				slopes.byVegType[vegIndex] = [vegName, labels[steepestIndex], maxSlope];
			});

		const burnData = runs.map((run) => run.burnPerc);
		const smoothedBurnPerc = smoothData(burnData, samplingWidth);
		smoothedBurnPerc.forEach((perc, i) => (runs[i].burnPerc = perc));

		const [steepestBurnIndex, maxBurnSlope] = getSteepest(smoothedBurnPerc);
		slopes.burntArea = [labels[steepestBurnIndex], maxBurnSlope];

		const stepsData = runs.map((run) => run.nbSteps);
		const smoothedSteps = smoothData(stepsData, samplingWidth);
		smoothedSteps.forEach((nb, i) => (runs[i].nbSteps = nb));

		const [steepestStepsIndex, maxStepsSlope] = getSteepest(smoothedSteps);
		slopes.stepNb = [labels[steepestStepsIndex], maxStepsSlope];


		const fireCentreData = runs.map((run) => run.fireCentre);
		const [greatestIndex, greatestGap] = getGreatestGap(fireCentreData);
		slopes.fireCentre = [labels[greatestIndex], greatestGap];

		slopes.upToDate = true;
	}
</script>

<section class="experiment">
	<h2>
		{expTitle}
		{#if ongoingExp}
			(expérience en cours...)
		{/if}
	</h2>
	<p>{expDescription}</p>

	<div class="launchBtns">
		{#if runs.length === 0}
			<button disabled={ongoingExp} onclick={() => fetchExpResults()} style="color: rebeccapurple">
				Lancer l&rsquo;expérience
			</button>
		{:else}
			<button disabled={ongoingExp} onclick={() => repeatExp()} style="color: darkslateblue">
				Répéter l&rsquo;expérience
			</button>
		{/if}

		<label class="nbSimsLabel">
			Nombre de simulations
			<input type="number" min={1} max={50} bind:value={config.nbIters} />
		</label>

		{#if runs.length > 0}
			<button
				disabled={ongoingExp || config.startVal === undefined}
				onclick={fetchExpResults}
				style="color: lightseagreen"
			>
				Continuer l&rsquo;expérience
			</button>
		{/if}
	</div>

	{#if runs.length > 0 && config.nbReps && config.nbReps > 1}
		<p style="text-align: center;" transition:slide>
			Chaque simulation a été répétée {config.nbReps} fois.
		</p>
	{/if}

	<div bind:this={resultsDiv}>
		{#if runs.length > 0}
			<ResultsDisplay {runs} {labels} {slopes} singleRow={compactDisp} {repeatedExp} />

			<div class="analysisControls">
				<label>
					<input type="checkbox" bind:checked={shouldSmooth} />
					Lisser les résultats
				</label>

				<button
					style="color: darkorange;"
					disabled={ongoingExp}
					onclick={analyseResults}
				>
					Analyser
				</button>
			</div>
		{/if}
	</div>
</section>

<style>
	.experiment {
		margin: 50px 0 70px;
	}

	.launchBtns {
		margin: 30px;
		display: flex;
		justify-content: space-around;
		font-size: 1.1em;
	}

	button {
		padding: 5px 8px;
	}

	.nbSimsLabel {
		text-align: center;

		input {
			box-sizing: border-box;
			width: 30%;
			margin: 5px;
		}
	}

	.analysisControls {
		display: flex;
		font-size: 1.1em;
		justify-content: center;
		align-items: center;
		gap: 30px;
		margin: 20px 0;

		button {
			display: block;
		}

		input[type='checkbox'] {
			width: 1.3em;
			height: 1.3em;
			vertical-align: middle;
			margin: 0 0.5em;
		}

		label {
			display: block;
			text-align: center;
			margin: 15px 0;
		}
	}
</style>
