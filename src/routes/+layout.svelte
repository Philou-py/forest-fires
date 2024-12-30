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

	:global(input) {
		font-family: inherit;
		font-size: 0.9em;
	}

	:global(button) {
		font-family: inherit;
		font-size: 1em;
	}
</style>
