<script lang="ts">
	import { onMount } from 'svelte';
	import type { Step } from '$lib/pipeline.js';
	import { type SavedView, loadViews, saveView, deleteView, renameView } from '$lib/views.js';

	let { steps, onload }: { steps: Step[]; onload: (steps: Step[]) => void } = $props();

	let views = $state<SavedView[]>([]);
	let saveName = $state('');
	let selectedName = $state('');
	let renaming = $state(false);
	let renameValue = $state('');

	onMount(() => {
		views = loadViews();
	});

	function refreshViews() {
		views = loadViews();
	}

	let selectedView = $derived(views.find((v) => v.name === selectedName) ?? null);

	function handleSave() {
		const name = saveName.trim();
		if (!name) return;
		saveView(name, steps);
		saveName = '';
		refreshViews();
		selectedName = name;
	}

	function handleLoad() {
		if (selectedView) {
			onload(JSON.parse(JSON.stringify(selectedView.steps)));
		}
	}

	function handleDelete() {
		if (!selectedView) return;
		deleteView(selectedView.name);
		selectedName = '';
		refreshViews();
	}

	function startRename() {
		if (!selectedView) return;
		renaming = true;
		renameValue = selectedView.name;
	}

	function finishRename() {
		if (!selectedView) return;
		const newName = renameValue.trim();
		if (newName && newName !== selectedView.name) {
			renameView(selectedView.name, newName);
			refreshViews();
			selectedName = newName;
		}
		renaming = false;
		renameValue = '';
	}

	function cancelRename() {
		renaming = false;
		renameValue = '';
	}
</script>

<div class="saved-views">
	<div class="views-row">
		<select
			bind:value={selectedName}
			onchange={() => { renaming = false; }}
		>
			<option value="">-- Saved Views --</option>
			{#each views as view}
				<option value={view.name}>{view.name}</option>
			{/each}
		</select>

		<button class="action-btn load" onclick={handleLoad} disabled={selectedView === null}>Load</button>

		{#if renaming}
			<input
				class="rename-input"
				type="text"
				bind:value={renameValue}
				onkeydown={(e) => {
					if (e.key === 'Enter') finishRename();
					if (e.key === 'Escape') cancelRename();
				}}
			/>
			<button class="action-btn" onclick={finishRename}>OK</button>
			<button class="action-btn" onclick={cancelRename}>Cancel</button>
		{:else}
			<button class="action-btn" onclick={startRename} disabled={selectedView === null}>Rename</button>
			<button class="action-btn delete" onclick={handleDelete} disabled={selectedView === null}>Delete</button>
		{/if}

		<span class="separator"></span>

		<input
			type="text"
			placeholder="New view name..."
			bind:value={saveName}
			onkeydown={(e) => { if (e.key === 'Enter') handleSave(); }}
		/>
		<button class="action-btn save" onclick={handleSave} disabled={!saveName.trim()}>Save</button>
	</div>
</div>

<style>
	.saved-views {
		margin-bottom: 20px;
	}

	.views-row {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}

	.views-row select {
		padding: 5px 10px;
		font-size: 13px;
		border: 1px solid #ccc;
		border-radius: 4px;
		min-width: 180px;
	}

	.views-row input {
		padding: 5px 10px;
		font-size: 13px;
		border: 1px solid #ccc;
		border-radius: 4px;
		width: 160px;
	}

	.rename-input {
		border-color: #2563eb !important;
	}

	.separator {
		width: 1px;
		height: 24px;
		background: #ddd;
		margin: 0 4px;
	}

	.action-btn {
		padding: 5px 10px;
		font-size: 13px;
		border: 1px solid #ccc;
		background: #fff;
		border-radius: 4px;
		cursor: pointer;
		color: #555;
	}

	.action-btn:hover:not(:disabled) {
		border-color: #999;
		color: #222;
	}

	.action-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.action-btn.load {
		border-color: #2563eb;
		color: #2563eb;
	}

	.action-btn.load:hover:not(:disabled) {
		background: #2563eb;
		color: #fff;
	}

	.action-btn.save {
		border-color: #16a34a;
		color: #16a34a;
	}

	.action-btn.save:hover:not(:disabled) {
		background: #16a34a;
		color: #fff;
	}

	.action-btn.delete:hover:not(:disabled) {
		border-color: #e11d48;
		color: #e11d48;
	}
</style>
