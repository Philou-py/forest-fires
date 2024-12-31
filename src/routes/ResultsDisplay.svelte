<script lang="ts">
	import type { SimResult } from '$lib/simulation';
	import { Chart, Ticks } from 'chart.js/auto';
	import { Vegetation } from '$lib/fireGrid';
	import { onMount } from 'svelte';

	Chart.defaults.maintainAspectRatio = false;
	Chart.defaults.font.family = 'Space Mono';
	// Assign colours automatically, even to a dynamically added dataset
	// https://www.chartjs.org/docs/latest/general/colors.html#dynamic-datasets-at-runtime
	Chart.defaults.plugins.colors.forceOverride = true;

	interface Props {
		runs: SimResult[];
		labels: string[];
		singleRow?: boolean;
		shouldReset?: boolean;
	}

	let { runs, labels, singleRow, shouldReset }: Props = $props();

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
	});

	$effect(() => {
		// If the simulations were reset, discard all previous results
		if (shouldReset) {
			chart1.data.datasets = runs.map(({ burnPercByVegType }, i) => ({
				label: labels[i],
				data: burnPercByVegType.map(([vegType, _, perc]) => ({ vegType, perc }))
			}));
			chart1.update();

			chart2.data.labels = [...labels];
			chart2.data.datasets[0].data = runs.map(({ burnPerc }) => burnPerc);
			chart2.update()

			chart3.data.labels = [...labels];
			chart3.data.datasets[0].data = runs.map(({ nbSteps }) => nbSteps);
			chart3.update()
			return;
		}

		// Pushing elements one by one prevents the whole chart from being rerendered
		// at each modification - instead, only the new data is nicely animated in.
		const chart1Datasets = chart1.data.datasets;
		while (chart1Datasets.length < runs.length) {
			chart1Datasets.push({
				label: labels[chart1Datasets.length],
				data: runs[chart1Datasets.length].burnPercByVegType.map(([vegType, _, perc]) => ({
					vegType,
					perc
				}))
			});
		}
		chart1.update();

		const chart2Data = chart2.data.datasets[0].data;
		while (chart2Data.length < runs.length) {
			chart2.data.labels!.push(labels[chart2Data.length]);
			chart2Data.push(runs[chart2Data.length].burnPerc);
		}
		chart2.update();

		const chart3Data = chart3.data.datasets[0].data;
		while (chart3Data.length < runs.length) {
			chart3.data.labels!.push(labels[chart3Data.length]);
			chart3Data.push(runs[chart3Data.length].nbSteps);
		}
		chart3.update();
	});
</script>

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

<style>
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
