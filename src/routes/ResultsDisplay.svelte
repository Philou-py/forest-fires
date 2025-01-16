<script lang="ts">
	import type { SimResult } from '$lib/simulation';
	import { Chart, Ticks } from 'chart.js/auto';
	import { Vegetation } from '$lib/fireGrid';
	import { onMount } from 'svelte';
	import { cubicInOut } from 'svelte/easing';
	import { slide } from 'svelte/transition';

	Chart.defaults.maintainAspectRatio = false;
	Chart.defaults.font.family = 'Space Mono';
	// Assign colours automatically, even to a dynamically added dataset
	// https://www.chartjs.org/docs/latest/general/colors.html#dynamic-datasets-at-runtime
	Chart.defaults.plugins.colors.forceOverride = true;

	interface Props {
		runs: SimResult[];
		labels: string[];
		slopes: {
			byVegType: [string, string, number][];
			burntArea: [string, number];
			stepNb: [string, number];
			upToDate: boolean;
		};
		singleRow?: boolean;
		shouldReset?: boolean;
	}

	let { runs, labels, slopes, singleRow, shouldReset }: Props = $props();

	let chartCanvas1: HTMLCanvasElement;
	let chartCanvas2: HTMLCanvasElement;
	let chartCanvas3: HTMLCanvasElement;
	let chartCanvas4: HTMLCanvasElement;

	let chart1: Chart<'bar', { vegType: string; perc: number | null }[], string>;
	let chart2: Chart<'bar', number[], string>;
	let chart3: Chart<'bar', number[], string>;
	let chart4: Chart<'scatter', [number, number][], number>;

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

		chart4 = new Chart(chartCanvas4, {
			type: 'scatter',
			data: {
				datasets: []
			},
			options: {
				elements: {
					point: {
						hitRadius: 5,
						radius: 6,
						hoverRadius: 8
					}
				},
				scales: {
					x: {
						min: 100,
						max: 800,
						position: 'top'
					},
					y: {
						min: 100,
						max: 800,
						reverse: true
					}
				},
				plugins: {
					title: {
						display: true,
						text: 'Position moyenne du terrain brûlé'
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
			chart2.update();

			chart3.data.labels = [...labels];
			chart3.data.datasets[0].data = runs.map(({ nbSteps }) => nbSteps);
			chart3.update();

			chart4.data.datasets = runs.map(({ fireCentre }, i) => ({
				label: labels[i],
				// Invert row/col to match x/y
				data: [[fireCentre[1], fireCentre[0]]]
			}));
			chart4.update();
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

		const chart4Data = chart4.data.datasets;
		while (chart4Data.length < runs.length) {
			chart4Data.push({
				label: labels[chart4Data.length],
				data: [[runs[chart4Data.length].fireCentre[1], runs[chart4Data.length].fireCentre[0]]]
			});
		}
		chart4.update();
	});

	function round(val: number) {
		return Math.round(val * 100) / 100;
	}
</script>

<div class:singleRow class:outdated={!slopes.upToDate}>
	<div class="chart">
		<canvas bind:this={chartCanvas1}></canvas>
	</div>

	{#if slopes.byVegType[1][2] !== -1}
		<table transition:slide={{ easing: cubicInOut }} class="slopesTable">
			<caption> Percolation du terrain brûlé par type de végétation </caption>

			<thead>
				<tr>
					{#each slopes.byVegType as [vegName] (vegName)}
						<th>{vegName}</th>
					{/each}
				</tr>
			</thead>

			<tbody>
				<tr>
					{#each slopes.byVegType as [vegName, vegAxis, slope] (vegName)}
						<td>
							{#if !Number.isNaN(slope)}
								{vegAxis} (pente max&nbsp;: {round(slope)})
							{/if}
						</td>
					{/each}
				</tr>
			</tbody>
		</table>
	{/if}

	<div class="chart">
		<canvas bind:this={chartCanvas2}></canvas>
	</div>

	{#if slopes.burntArea[1] !== -1}
		<p transition:slide={{ easing: cubicInOut }} class="slopeText">
			Percolation du terrain brûlé pour {slopes.burntArea[0]} (pente max&nbsp;: {round(
				slopes.burntArea[1]
			)}).
		</p>
	{/if}

	<div class="chart">
		<canvas bind:this={chartCanvas3}></canvas>
	</div>

	{#if slopes.burntArea[1] !== -1}
		<p transition:slide={{ easing: cubicInOut }} class="slopeText">
			Percolation du nombre d&rsquo;étapes pour {slopes.stepNb[0]} (pente max&nbsp;: {round(
				slopes.stepNb[1]
			)}).
		</p>
	{/if}

	<div class="chart">
		<canvas bind:this={chartCanvas4}></canvas>
	</div>
</div>

<style>
	.singleRow {
		display: flex;
		gap: 20px;

		.chart {
			flex: 1 1 0;
			height: 30vh;
		}
	}

	.outdated {
		.slopeText,
		.slopesTable {
			opacity: 0.4;
		}
	}

	.chart {
		margin: 40px 0;
		/* Fit exactly three charts on one screen */
		height: calc(33vh - 2 / 3 * 40px);
		min-height: 200px;
		/* Recommended by Chart.js for responsive charts */
		position: relative;
	}

	canvas {
		max-width: 100%;
	}

	.slopeText {
		text-align: center;
	}

	.slopesTable {
		table-layout: fixed;
		width: 100%;
		border-collapse: collapse;
		border: 1px solid black;

		caption {
			font-size: 1.1em;
			padding: 10px 0;
		}

		th,
		td {
			padding: 10px;
			border: 1px solid black;
			text-align: left;
		}
	}
</style>
