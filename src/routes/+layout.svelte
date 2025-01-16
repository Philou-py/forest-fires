<script lang="ts">
	import "@fontsource/space-mono";

  let { children } = $props();
</script>

{@render children()}

<style>
	:global(html) {
		scroll-behavior: smooth;
	}

	:global(body) {
		margin: 0;
		font-family: 'Space Mono';
	}

	:global(input, select) {
		box-sizing: border-box;
		font-family: inherit;
		font-size: 0.9em;
		padding: 1px 2px;
	}

	:global(button) {
		font-family: inherit;
		font-size: 1em;
	}
</style>
