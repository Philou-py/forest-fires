<script lang="ts">
	let dialog: HTMLDialogElement;

	interface Props {
		expTitle: string;
		expDescription: string;
		strConfig: string;
		open: boolean;
		onValidate: (title: string, description: string, strConfig: string) => void;
	}

	let { expTitle, expDescription, strConfig, open = $bindable(), onValidate }: Props = $props();

	$effect(() => {
		if (open) {
			dialog.showModal();
		} else {
			dialog.close();
		}
	});

	let title = $state(expTitle);
	let description = $state(expDescription);
	let config = $state(strConfig);
</script>

<dialog bind:this={dialog}>
	<div class="contents">
		<h3>Configuration de l&rsquo;expérience</h3>
		<label>
			Titre
			<input bind:value={title} autocomplete="off" />
		</label>

		<label>
			Description
			<textarea bind:value={description} autocomplete="off"></textarea>
		</label>

		<textarea spellcheck={false} bind:value={config} autocomplete="off"></textarea>

		<div class="actions">
			<button onclick={() => (open = false)} style="color: saddlebrown">Annuler</button>

			<button
				onclick={() => onValidate(title, description, config)}
				style="color: forestgreen">Valider</button
			>
		</div>
	</div>
</dialog>

<style>
	dialog {
		width: 50%;
		height: 70%;

		h3 {
			text-align: center;
		}

		.contents {
			display: flex;
			height: 100%;
			flex-direction: column;
		}

		label {
			display: flex;
			gap: 15px;
			margin: 15px 0;
			font-weight: bold;

			textarea {
				flex-grow: 1;
			}
		}

		textarea {
			font-size: 1.2em;
			flex-grow: 1;
			margin: 5px 5px 20px;
		}

		.actions {
			display: flex;
			justify-content: flex-end;
			gap: 20px;
			font-size: 1em;

			button {
				padding: 3px 5px;
			}
		}
	}
</style>
