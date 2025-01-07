<script lang="ts">
	import ResultsDisplay from './ResultsDisplay.svelte';

	interface Props {
		expNb: number;
		expTitle: string;
		expDescription: string;
		initialVal: number;
		compactDisp?: boolean;
	}
	import type { ExpResults, SimResult } from '$lib/simulation';
	import { tick } from 'svelte';

	let { expNb, expTitle, expDescription, initialVal, compactDisp }: Props = $props();

	let resultsDiv: HTMLDivElement;

	// Counts the number of pending fetch calls
	let ongoingExp = $state(false);
	let shouldReset = $state(false);
	let runs: SimResult[] = $state([]);
	let labels: string[] = $state([]);
	let startVal: number | undefined = $state(initialVal);
	let nbIters = $state(5);

	async function fetchExpResults(restart?: boolean) {
		ongoingExp = true;

		if (restart) {
			startVal = initialVal;
		}

		const response = await fetch(
			`/api/simulate/?expNb=${expNb}&nbIters=${nbIters}&startVal=${startVal}`
		);
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
		startVal = results.nextExp;
		ongoingExp = false;
		await tick();
		resultsDiv.scrollIntoView();
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
		<button disabled={ongoingExp} onclick={() => fetchExpResults(true)} style="color: rebeccapurple">
			{runs.length > 0 ? 'Rel' : 'L'}ancer l&rsquo;expérience
		</button>

		<label class="nbSimsLabel">
			Nombre de simulations
			<input type="number" min={1} max={50} bind:value={nbIters} />
		</label>

		{#if runs.length > 0}
			<button
				disabled={ongoingExp || startVal === undefined}
				onclick={() => fetchExpResults()}
				style="color: lightseagreen"
			>
				Continuer l&rsquo;expérience
			</button>
		{/if}
	</div>

	<div bind:this={resultsDiv}>
		{#if runs.length > 0}
			<ResultsDisplay {runs} {labels} singleRow={compactDisp} {shouldReset} />
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
