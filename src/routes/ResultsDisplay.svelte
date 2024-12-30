<script lang="ts">
	import type { ExpResults } from '$lib/simulation';
	import { Chart, Ticks } from 'chart.js/auto';
	import { Vegetation } from '$lib/fireGrid';
	import { onMount } from 'svelte';

	Chart.defaults.maintainAspectRatio = false;
	Chart.defaults.font.family = 'Space Mono';
	// Assign colours automatically, even to a dynamically added dataset
	// https://www.chartjs.org/docs/latest/general/colors.html#dynamic-datasets-at-runtime
	Chart.defaults.plugins.colors.forceOverride = true;

	interface Props extends ExpResults {
		singleRow?: boolean;
	}

	let { expTitle, expDescription, runs, singleRow }: Props = $props();

	let resultsSection: HTMLElement;
	let chartCanvas1: HTMLCanvasElement;
	let chartCanvas2: HTMLCanvasElement;
	let chartCanvas3: HTMLCanvasElement;

	let chart1: Chart<'bar', { vegType: string; perc: number | null }[], string>;
	let chart2: Chart<'bar', number[], string>;
	let chart3: Chart<'bar', number[], string>;

	onMount(() => {
		Chart.defaults.devicePixelRatio = 2 * window.devicePixelRatio;

		chart1 = new Chart(chartCanvas1, {
			type: 'bar',
			data: {
				labels: [...Object.keys(Vegetation)].filter((vegType) => vegType !== 'NoVeg'),
				datasets: []
			},
			options: {
				plugins: {
					title: {
						display: true,
						text: 'Terrain brûlé par type de végétation'
					}
				},
				parsing: {
					xAxisKey: 'vegType',
					yAxisKey: 'perc'
				},
				scales: {
					y: {
						ticks: {
							callback: function (value, index, ticks) {
								return Ticks.formatters.numeric.apply(this, [value as number, index, ticks]) + '%';
							}
						}
					}
				}
			}
		});

		chart2 = new Chart(chartCanvas2, {
			type: 'bar',
			data: {
				labels: [],
				datasets: [{ data: [] }]
			},
			options: {
				plugins: {
					title: {
						display: true,
						text: 'Terrain brûlé'
					},
					legend: {
						display: false
					}
				},
				scales: {
					y: {
						ticks: {
							callback: function (value, index, ticks) {
								return Ticks.formatters.numeric.apply(this, [value as number, index, ticks]) + '%';
							}
						}
					}
				}
			}
		});

		chart3 = new Chart(chartCanvas3, {
			type: 'bar',
			data: {
				labels: [],
				datasets: [{ data: [] }]
			},
			options: {
				plugins: {
					title: {
						display: true,
						text: 'Étapes effectuées'
					},
					legend: {
						display: false
					}
				}
			}
		});

		resultsSection.scrollIntoView();
	});

	$effect(() => {
		const simsLabels = runs.map((_, i) => `Sim ${i + 1}`);

		const chart1Datasets = chart1.data.datasets;
		while (chart1Datasets.length < runs.length) {
			chart1Datasets.push({
				label: simsLabels[chart1Datasets.length],
				data: runs[chart1Datasets.length].burnPercByVegType.map(([vegType, _, perc]) => ({
					vegType,
					perc
				}))
			});
		}
		chart1.update();

		const chart2Data = chart2.data.datasets[0].data;
		while (chart2Data.length < runs.length) {
			chart2.data.labels!.push(`Sim ${chart2Data.length}`);
			chart2Data.push(runs[chart2Data.length].burnPerc);
		}
		chart2.update();

		const chart3Data = chart3.data.datasets[0].data;
		while (chart3Data.length < runs.length) {
			chart3.data.labels!.push(`Sim ${chart3Data.length}`);
			chart3Data.push(runs[chart3Data.length].nbSteps);
		}
		chart3.update();
	});
</script>

<section class="results" bind:this={resultsSection}>
	<h2>{expTitle}</h2>
	<p>{expDescription}</p>

	<div class:singleRow>
		<div class="chart">
			<canvas bind:this={chartCanvas1}></canvas>
		</div>
		<div class="chart">
			<canvas bind:this={chartCanvas2}></canvas>
		</div>
		<div class="chart">
			<canvas bind:this={chartCanvas3}></canvas>
		</div>
	</div>
</section>

<style>
	.results {
		margin: 50px 0;
	}

	.singleRow {
		display: flex;
		gap: 20px;

		.chart {
			flex: 1 1 0;
		}
	}

	.chart {
		margin: 40px 0;
		height: 33vh;
		/* Recommended by Chart.js for responsive charts */
		position: relative;
	}

	canvas {
		max-width: 100%;
	}
</style>
