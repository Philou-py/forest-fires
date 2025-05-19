<script lang="ts">
	import { onMount } from 'svelte';

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;
	let dpr: number;

	const ACTIVE = '#607d8b';
	const NEIGHBOURING = '#b0bec5';

	function updateDpr() {
		dpr = window.devicePixelRatio + 1;

		const rect = canvas.getBoundingClientRect();
		canvas.width = rect.width * dpr;
		canvas.height = rect.height * dpr;
		ctx.scale(dpr, dpr);
		canvas.style.width = `${rect.width}px`;
		canvas.style.height = `${rect.height}px`;

		const mql = matchMedia(`(resolution: ${dpr}dppx)`);
		mql.addEventListener('change', updateDpr, { once: true });
	}

	onMount(() => {
		ctx = canvas.getContext('2d')!;
		updateDpr();
		// Add padding to avoid rendering issues with the edge of the canvas
		ctx.translate(10, 10);

		drawGrid(5, 50, [
			[2, 1, '', ACTIVE],
			[2, 2, '', ACTIVE],
			[2, 3, '', ACTIVE]
		]);

		ctx.translate(300, 0);
		drawGrid(5, 50, [
			[1, 2, 'darkorange', ACTIVE],
			[2, 2, '', ACTIVE],
			[3, 2, 'darkorange', ACTIVE],
			[2, 1, 'orangered', 'white'],
			[2, 3, 'orangered', 'white']
		]);

		ctx.strokeStyle = 'black';
		ctx.fillStyle = 'black';

		ctx.translate(290, 30);
		drawSq(0, 0, 30, '', ACTIVE);

		ctx.font = '20px sans';
		ctx.fillText('Cellule active', 40, 20);

		ctx.translate(0, 50);
		drawSq(0, 0, 30, '', 'white');

		ctx.font = '20px sans';
		ctx.fillText('Cellule inactive', 40, 20);

		ctx.translate(0, 50);
		drawSq(0, 0, 30, 'darkorange', ACTIVE);

		ctx.font = '20px sans';
		ctx.fillText('Cellule devenue active', 40, 20);

		ctx.translate(0, 50);
		drawSq(0, 0, 30, 'orangered', 'white');

		ctx.font = '20px sans';
		ctx.fillText('Cellule devenue inactive', 40, 20);

		ctx.resetTransform();
		ctx.scale(dpr, dpr);

		ctx.translate(10, 350);
		drawGrid(7, 40, [
			[3, 3, '', ACTIVE],
			[2, 3, '', NEIGHBOURING],
			[3, 2, '', NEIGHBOURING],
			[3, 4, '', NEIGHBOURING],
			[4, 3, '', NEIGHBOURING]
		]);

		ctx.fillText(`Von Neumann`, 70, 310);

		ctx.translate(320, 0);
		mooreNeigh(1);

		ctx.translate(320, 0);
		mooreNeigh(2);

		ctx.resetTransform();
		ctx.scale(dpr, dpr);

		ctx.translate(10, 350 * 2);

		const ON_FIRE = '#ff5722';
		const FOREST = '#8de368';
		const grid = [
			[false, true, false, false, false, false, false],
			[false, true, false, false, false, false, false],
			[false, false, true, false, true, false, false],
			[false, true, true, true, true, false, false],
			[false, false, false, false, true, false, false],
			[false, false, false, true, true, true, false],
			[false, false, false, true, false, false, false]
		];

		const sqSize = 50;
		const size = 7;
		ctx.globalAlpha = 189 / 255;
		for (let i = 0; i < size; i++) {
			for (let j = 0; j < size; j++) {
				if (!(i === 3 && j === 3) && !(i === 1 && j === 4)) {
					ctx.fillStyle = grid[i][j] ? ON_FIRE : FOREST;
					ctx.fillRect(sqSize * j, sqSize * i, sqSize, sqSize);
				}
			}
		}

		// Create a linear colour gradient between two points
		const fireGradient = ctx.createLinearGradient(3 * sqSize, 3 * sqSize, 4 * sqSize, 4 * sqSize);
		const fireColourStops: [number, string][] = [
			[0, '#d53301'],
			[0.1, '#d53301'],
			[0.1, ON_FIRE],
			[0.2, ON_FIRE],
			[0.2, '#d53301'],
			[0.3, '#d53301'],
			[0.3, ON_FIRE],
			[0.4, ON_FIRE],
			[0.4, '#d53301'],
			[0.5, '#d53301'],
			[0.5, ON_FIRE],
			[0.6, ON_FIRE],
			[0.6, '#d53301'],
			[0.7, '#d53301'],
			[0.7, ON_FIRE],
			[0.8, ON_FIRE],
			[0.8, '#d53301'],
			[0.9, '#d53301'],
			[0.9, ON_FIRE],
			[1, ON_FIRE]
		];
		fireColourStops.forEach(([stop, col]) => {
			fireGradient.addColorStop(stop, col);
		});

		ctx.fillStyle = fireGradient;
		ctx.fillRect(3 * sqSize, 3 * sqSize, sqSize, sqSize);

		const forestGradient = ctx.createLinearGradient(4 * sqSize, sqSize, 5 * sqSize, 2 * sqSize);
		let forestColourStops: [number, string][] = [
			[0, '#3d9c14'],
			[0.1, '#3d9c14'],
			[0.1, FOREST],
			[0.2, FOREST],
			[0.2, '#3d9c14'],
			[0.3, '#3d9c14'],
			[0.3, FOREST],
			[0.4, FOREST],
			[0.4, '#3d9c14'],
			[0.5, '#3d9c14'],
			[0.5, FOREST],
			[0.6, FOREST],
			[0.6, '#3d9c14'],
			[0.7, '#3d9c14'],
			[0.7, FOREST],
			[0.8, FOREST],
			[0.8, '#3d9c14'],
			[0.9, '#3d9c14'],
			[0.9, FOREST],
			[1, FOREST]
		];
		forestColourStops.forEach(([stop, col]) => {
			forestGradient.addColorStop(stop, col);
		});

		ctx.fillStyle = forestGradient;
		ctx.fillRect(4 * sqSize, sqSize, sqSize, sqSize);

		ctx.globalAlpha = 1;

		ctx.strokeStyle = ACTIVE;
		ctx.strokeRect(sqSize, sqSize, 5 * sqSize, 5 * sqSize);

		ctx.fillStyle = ACTIVE;
		ctx.fillText('Limite du voisinage', 3 * sqSize, 3 * sqSize / 4);

		ctx.strokeStyle = '#333';
		ctx.fillStyle = '#333';
		const centre = (size * sqSize) / 2;
		const endX = 4.5 * sqSize;
		const endY = 1.5 * sqSize;
		drawArrow(centre, centre, endX, endY, true);
		drawArrow(endX, endY, centre, centre, true);

		ctx.fillText('𝑑', centre + 8, centre - 50);

		ctx.beginPath();
		ctx.moveTo(0, centre);
		ctx.setLineDash([7, 10]);
		ctx.lineTo(size * sqSize, centre);
		ctx.stroke();
		ctx.setLineDash([]);

		ctx.beginPath();
		ctx.arc(centre, centre, 30, 0, Math.atan2(endY - centre, endX - centre), true);
		ctx.stroke();
		ctx.fillText('𝜃', centre + 35, centre - 15);

		ctx.fillStyle = 'darkmagenta';
		ctx.strokeStyle = 'darkmagenta';
		drawArrow(centre, centre, centre + 2 * sqSize, centre + 2 * sqSize, true);
		ctx.fillText('𝑣', centre + 30, centre + sqSize + 10);

		ctx.beginPath();
		ctx.arc(centre, centre, 30, 0, Math.PI / 4);
		ctx.stroke();
		ctx.fillText('𝜃ᵥ', centre + 35, centre + 23);
	});

	function drawGrid(size = 10, sqSize = 50, filled: [number, number, string, string][] = []) {
		ctx.lineWidth = 2;
		for (let i = 0; i < size; i++) {
			for (let j = 0; j < size; j++) {
				ctx.strokeRect(sqSize * j, sqSize * i, sqSize, sqSize);
			}
		}

		for (let [i, j, stroke, fill] of filled) {
			drawSq(sqSize * j, sqSize * i, sqSize, stroke || 'black', fill || 'white');
		}
	}

	function drawSq(x: number, y: number, sqSize: number, stroke: string, fill: string) {
		const originalStroke = ctx.strokeStyle;
		const originalFill = ctx.fillStyle;

		ctx.fillStyle = fill;
		ctx.fillRect(x, y, sqSize, sqSize);

		ctx.strokeStyle = stroke;
		if (stroke !== 'black') {
			ctx.strokeRect(x + 1, y + 1, sqSize - 2, sqSize - 2);
		} else {
			ctx.strokeRect(x, y, sqSize, sqSize);
		}

		ctx.strokeStyle = originalStroke;
		ctx.fillStyle = originalFill;
	}

	function mooreNeigh(spread: number) {
		let neigh: [number, number, string, string][] = [];
		for (let i = 3 - spread; i <= 3 + spread; i++) {
			for (let j = 3 - spread; j <= 3 + spread; j++) {
				if (i == 3 && j == 3) neigh.push([i, j, '', ACTIVE]);
				else neigh.push([i, j, '', NEIGHBOURING]);
			}
		}

		drawGrid(7, 40, neigh);

		ctx.fillText(`Moore, étendue ${spread}`, 60, 310);
	}

	function drawLine(x1: number, y1: number, x2: number, y2: number) {
		ctx.beginPath();
		ctx.moveTo(x1, y1);
		ctx.lineTo(x2, y2);
		ctx.stroke();
	}

	function drawHead(x1: number, y1: number, x2: number, y2: number, filled: boolean) {
		const dx = x2 - x1;
		const dy = y2 - y1;
		ctx.beginPath();
		ctx.moveTo(x1 + 0.5 * dy, y1 - 0.5 * dx);
		ctx.lineTo(x1 - 0.5 * dy, y1 + 0.5 * dx);
		ctx.lineTo(x2, y2);
		ctx.closePath();
		filled ? ctx.fill() : ctx.stroke();
	}

	function drawArrow(x1: number, y1: number, x2: number, y2: number, filled: boolean) {
		const t = 0.9;
		const dx = x2 - x1;
		const dy = y2 - y1;
		const middleX = dx * t + x1;
		const middleY = dy * t + y1;
		drawLine(x1, y1, middleX, middleY);
		drawHead(middleX, middleY, x2, y2, filled);
	}
</script>

<main>
	<canvas bind:this={canvas} width="1100" height="1200"></canvas>
</main>

<style>
	main {
		display: flex;
		margin: 30px 20px 30px;
		justify-content: center;
		align-items: center;
	}

	canvas {
		border: 1px dashed lightgrey;
	}
</style>
