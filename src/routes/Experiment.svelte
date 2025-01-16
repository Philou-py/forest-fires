<script lang="ts">
	import ResultsDisplay from './ResultsDisplay.svelte';

	interface Props {
		expTitle: string;
		expDescription: string;
		initialConfig: ExpConfig;
		compactDisp?: boolean;
	}
	import type { ExpConfig, ExpResults, SimResult } from '$lib/simulation';
	import { tick } from 'svelte';
	import { smoothData } from '$lib/results';
	import { Vegetation } from '$lib/fireGrid';

	let { expTitle, expDescription, initialConfig, compactDisp }: Props = $props();

	let resultsDiv: HTMLDivElement;

	// Counts the number of pending fetch calls
	let ongoingExp = $state(false);
	let shouldReset = $state(false);
	let runs: SimResult[] = $state([]);
	let labels: string[] = $state([]);
	let config: ExpConfig = $state(initialConfig);

	let slopes = $state({
		byVegType: [...Array(7)].map(() => ["", "", -1]),
		burntArea: ["", -1],
		stepNb: ["", -1],
		upToDate: true,
	});

	async function fetchExpResults(restart?: boolean) {
		ongoingExp = true;
		slopes.upToDate = false;

		if (restart) {
			config.startVal = config.min;
		}

		const response = await fetch(`/api/simulate/`, {
			method: 'POST',
			headers: {
				'Content-Type': 'applications/json'
			},
			body: JSON.stringify(config)
		});
		const results: ExpResults = await response.json();

		if (restart) {
			runs = [];
			labels = [];
			shouldReset = true;
		} else {
			shouldReset = false;
		}
		runs.push(...results.runs);
		labels.push(...results.labels);
		config.startVal = results.nextExp;
		ongoingExp = false;
		await tick();
		resultsDiv.scrollIntoView();
	}

	async function smoothResults() {
		// Force repaint of the data series
		const originalReset = shouldReset;
		shouldReset = true;
		await tick();
		const samplingWidth = Math.floor(runs.length / 10);

		[...Array(Object.values(Vegetation).length - 1)].forEach((_, vegIndex) => {
			if (runs.length > 0 && runs[0].burnPercByVegType[vegIndex][2] === null) return;
			const vegName = runs[0].burnPercByVegType[vegIndex][0];

			const [steepestSlope, steepestAxis] = smoothData(
				runs,
				(i) => runs[i].burnPercByVegType[vegIndex][2]!,
				(i, v) => (runs[i].burnPercByVegType[vegIndex][2] = v),
				samplingWidth
			);
			
			slopes.byVegType[vegIndex] = [vegName, labels[steepestAxis], steepestSlope]
			console.log(`Steepest slope of ${vegName}: ${steepestSlope} for ${labels[steepestAxis]}`);
		});

		const [burnSlope, burnAxis] = smoothData(
			runs,
			(i) => runs[i].burnPerc,
			(i, v) => (runs[i].burnPerc = v),
			samplingWidth
		);
		slopes.burntArea = [labels[burnAxis], burnSlope];
		console.log(`Steepest slope of the burn percentage: ${burnSlope} for ${labels[burnAxis]}`);

		const [stepSlope, stepAxis] = smoothData(
			runs,
			(i) => runs[i].nbSteps,
			(i, v) => (runs[i].nbSteps = v),
			samplingWidth
		);
		console.log(`Steepest slope of the step number: ${stepSlope} for ${labels[stepAxis]}`);
		slopes.stepNb = [labels[stepAxis], stepSlope];

		slopes.upToDate = true;
		shouldReset = originalReset;
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
		<button
			disabled={ongoingExp}
			onclick={() => fetchExpResults(true)}
			style="color: rebeccapurple"
		>
			{runs.length > 0 ? 'Rel' : 'L'}ancer l&rsquo;expérience
		</button>

		<label class="nbSimsLabel">
			Nombre de simulations
			<input type="number" min={1} max={50} bind:value={config.nbIters} />
		</label>

		{#if runs.length > 0}
			<button
				disabled={ongoingExp || config.startVal === undefined}
				onclick={() => fetchExpResults()}
				style="color: lightseagreen"
			>
				Continuer l&rsquo;expérience
			</button>
		{/if}
	</div>

	<div bind:this={resultsDiv}>
		{#if runs.length > 0}
			<ResultsDisplay {runs} {labels} {slopes} singleRow={compactDisp} {shouldReset} />

			<button
				disabled={ongoingExp}
				onclick={smoothResults}
				style="font-size: 1.1em; margin: 20px auto; display: block"
			>
				Lisser les résultats
			</button>
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
</style>
