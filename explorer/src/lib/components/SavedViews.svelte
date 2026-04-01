<script lang="ts">
	import { onMount } from 'svelte';
	import type { Step } from '$lib/pipeline.js';
	import { DEFAULT_VIEW } from '$lib/pipeline.js';
	import { type SavedView, loadViews, saveView, deleteView, renameView } from '$lib/views.js';

	let { steps, onload }: { steps: Step[]; onload: (steps: Step[]) => void } = $props();

	const BUILTIN_VIEWS: SavedView[] = [
		{ name: 'Default', steps: DEFAULT_VIEW },
	];

	let userViews = $state<SavedView[]>([]);
	let selectedName = $state('Default');
	let renaming = $state(false);
	let renameValue = $state('');

	let allViews = $derived([...BUILTIN_VIEWS, ...userViews]);
	let isBuiltin = $derived(BUILTIN_VIEWS.some((v) => v.name === selectedName));

	onMount(() => {
		userViews = loadViews();
	});

	function refreshViews() {
		userViews = loadViews();
	}

	let selectedView = $derived(allViews.find((v) => v.name === selectedName) ?? null);

	function handleCreate() {
		const name = prompt('View name:');
		if (!name || !name.trim()) return;
		saveView(name.trim(), steps);
		refreshViews();
		selectedName = name.trim();
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
			onchange={() => {
				renaming = false;
				if (selectedView) {
					onload(JSON.parse(JSON.stringify(selectedView.steps)));
				}
			}}
		>
			{#each BUILTIN_VIEWS as view}
				<option value={view.name}>{view.name}</option>
			{/each}
			{#if userViews.length > 0}
				<option disabled>──────────</option>
				{#each userViews as view}
					<option value={view.name}>{view.name}</option>
				{/each}
			{/if}
		</select>

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
			<button class="action-btn" onclick={startRename} disabled={selectedView === null || isBuiltin}>Rename</button>
			<button class="action-btn delete" onclick={handleDelete} disabled={selectedView === null || isBuiltin}>Delete</button>
		{/if}

		<span class="separator"></span>

		<button class="action-btn save" onclick={handleCreate}>Create View</button>
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
