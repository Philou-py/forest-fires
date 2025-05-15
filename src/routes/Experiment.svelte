<script lang="ts">
	import ResultsDisplay from './ResultsDisplay.svelte';
	import ExpModal from './ExpModal.svelte';
	import type { ExpConfig, ExpResults, SimResult } from '$lib/simulation';
	import type { ExpData } from './+page.server';
	import { tick } from 'svelte';
	import { slide } from 'svelte/transition';
	import { getGreatestGap, getSteepest, mergeRuns, smoothData } from '$lib/results';
	import { Vegetation } from '$lib/fireGrid';

	interface Props {
		expData: ExpData;
		compactDisp?: boolean;
	}

	let { expData, compactDisp }: Props = $props();
	let expTitle = $state(expData.expTitle);
	let expDescription = $state(expData.expDescription || '');

	let resultsDiv: HTMLDivElement;

	let ongoingExp = $state(false);
	let repeatedExp = $state(false);
	let runs: SimResult[] = $state(expData.expResults ? expData.expResults.runs : []);
	let labels: string[] = $state(expData.expResults ? expData.expResults.labels : []);
	let config: ExpConfig = $state(expData.expConfig);
	let shouldSmooth = $state(false);
	let showModal = $state(false);

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
			nextExp: config.startVal,
			nbIters: runs.length,
			nbReps: config.begNbReps
		};

		const response = await fetch(`/api/simulate/`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(repeatConfig)
		});
		const results: ExpResults = await response.json();

		repeatedExp = true;
		mergeRuns(runs, config.nbReps, results.runs, repeatConfig.nbReps);
		config.nbReps += config.begNbReps;

		ongoingExp = false;

		const repResponse = await fetch('/api/repeat-exp', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				expUid: expData.uid,
				runs,
				labels,
				nextExp: config.startVal,
				expConfigUid: config.uid,
				nbReps: config.nbReps
			})
		});
		const repResult = await repResponse.json();
		console.log(repResult);
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
		const results: ExpResults & { nextExp: number } = await response.json();

		runs.push(...results.runs);
		labels.push(...results.labels);
		config.nextExp = results.nextExp;

		ongoingExp = false;
		await tick();
		resultsDiv.scrollIntoView();

		const saveResponse = await fetch('/api/save-exp', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				expUid: expData.uid,
				configUid: config.uid,
				runs,
				labels,
				nextExp: config.nextExp
			})
		});
		const saveResult = await saveResponse.json();
		console.log(saveResult);
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

	async function resetExp() {
		const resetResponse = await fetch('/api/reset-exp', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				expUid: expData.uid,
				expConfigUid: config.uid,
				begNbReps: expData.expConfig.begNbReps
			})
		});
		const resetResult = await resetResponse.json();
		console.log(resetResult);
	}

	async function sendUpdated(title: string, description: string, strConfig: string) {
		const newConfig = JSON.parse(strConfig);
		const updateResponse = await fetch('/api/update-exp', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				expUid: expData.uid,
				expTitle: title,
				expDescription: description,
				newConfig
			})
		});
		const updateResult = await updateResponse.json();
		console.log(updateResult);

		if (!updateResult.error) {
			showModal = false;
			config = newConfig;
			expTitle = title;
			expDescription = description;
		}
	}

	async function deleteExp() {
		const updateResponse = await fetch('/api/del-exp', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ expUid: expData.uid })
		});
		const delResult = await updateResponse.json();
		console.log(delResult);
	}
</script>

<section class="experiment">
	<h2>
		{expTitle}
		{#if ongoingExp}
			(expérience en cours...)
		{/if}

		<button class="deleteBtn" onclick={deleteExp}>Supprimer</button>
	</h2>
	<p>{expDescription}</p>

	<div class="config">
		<ul>
			{#each Object.entries(config) as [key, val]}
				<li>
					<span>{key}</span>:
					{#if typeof val === 'object'}
						<ul>
							{#each Object.entries(val) as [subkey, subval]}
								<li><span>{subkey}</span>: {subval}</li>
							{/each}
						</ul>
					{:else}
						{val}
					{/if}
				</li>
			{/each}
		</ul>
	</div>

	<ExpModal
		{expTitle}
		{expDescription}
		strConfig={JSON.stringify(config, null, 4)}
		bind:open={showModal}
		onValidate={sendUpdated}
	/>

	<button style="display: block; margin: 10px auto" onclick={() => (showModal = true)}>
		Modifier
	</button>

	<div class="launchBtns">
		{#if runs.length === 0}
			<button disabled={ongoingExp} onclick={fetchExpResults} style="color: rebeccapurple">
				Lancer l&rsquo;expérience
			</button>
		{:else}
			<button disabled={ongoingExp} onclick={repeatExp} style="color: darkslateblue">
				Répéter l&rsquo;expérience
			</button>
		{/if}

		<label class="nbSimsLabel">
			Nombre de simulations
			<input type="number" autocomplete="off" min={1} max={50} bind:value={config.nbIters} />
		</label>

		{#if runs.length > 0}
			<button disabled={ongoingExp} onclick={fetchExpResults} style="color: lightseagreen">
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

			<div class="resultsControls">
				<div class="analysis">
					<label>
						<input type="checkbox" bind:checked={shouldSmooth} />
						Lisser les résultats
					</label>

					<button style="color: darkorange;" disabled={ongoingExp} onclick={analyseResults}>
						Analyser
					</button>
				</div>

				<button style="color: orangered" disabled={ongoingExp} onclick={resetExp}>
					Réinitialiser
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
		padding: 3px 8px;
	}

	.nbSimsLabel {
		text-align: center;

		input {
			box-sizing: border-box;
			width: 30%;
			margin: 5px;
		}
	}

	.resultsControls {
		display: flex;
		font-size: 1.1em;
		justify-content: space-between;
		margin: 20px 0;

		.analysis {
			display: flex;
			align-items: center;
			gap: 20px;
		}

		button {
			display: block;
		}

		input[type='checkbox'] {
			width: 1.3em;
			height: 1.3em;
			vertical-align: middle;
		}

		label {
			display: block;
			text-align: center;
		}
	}

	.config {
		margin: 30px 0;
		column-count: 3;

		& > ul {
			padding-left: 0;
		}

		ul {
			margin: 0;
			list-style-type: none;
		}

		span {
			font-weight: bold;
		}
	}

	.deleteBtn {
		float: right;
		color: darkred;
		font-size: 0.6em;
	}
</style>
