<script lang="ts">
	import { onMount } from 'svelte';
	import { loadTablets, type Tablet } from '../../../lib/drawtab-loader.js';
	import {
		type Step,
		DEFAULT_COLUMNS,
		executePipeline,
	} from '$lib/pipeline.js';
	import FilterStep from '$lib/components/FilterStep.svelte';
	import SortStep from '$lib/components/SortStep.svelte';
	import SelectStep from '$lib/components/SelectStep.svelte';
	import TakeStep from '$lib/components/TakeStep.svelte';
	import ResultsTable from '$lib/components/ResultsTable.svelte';
	import SavedViews from '$lib/components/SavedViews.svelte';

	let allTablets: Tablet[] = $state([]);
	let steps: Step[] = $state([]);
	let tick = $state(0);

	let result = $derived.by(() => {
		void tick;
		return executePipeline(allTablets, steps);
	});

	function refresh() {
		tick++;
	}

	function addStep(kind: Step['kind']) {
		switch (kind) {
			case 'filter':
				steps.push({ kind: 'filter', field: 'ModelBrand', operator: '==', value: '' });
				break;
			case 'sort':
				steps.push({ kind: 'sort', field: 'ModelBrand', direction: 'asc' });
				break;
			case 'select':
				if (!steps.some((s) => s.kind === 'select')) {
					steps.push({ kind: 'select', fields: [...DEFAULT_COLUMNS] });
				}
				break;
			case 'take':
				steps.push({ kind: 'take', count: 50 });
				break;
		}
	}

	function removeStep(index: number) {
		steps.splice(index, 1);
	}

	function loadView(loaded: Step[]) {
		steps = loaded;
		refresh();
	}

	onMount(async () => {
		allTablets = await loadTablets('');
	});
</script>

<h1>DrawTabData Explorer</h1>

<SavedViews {steps} onload={loadView} />

<div class="pipeline">
	<div class="pipeline-source">
		Tablets <span class="count">({allTablets.length} records)</span>
	</div>

	{#each steps as step, i (i)}
		<div class="pipe-connector">|</div>

		{#if step.kind === 'filter'}
			<FilterStep bind:step={steps[i]} onchange={refresh} onremove={() => removeStep(i)} />
		{:else if step.kind === 'sort'}
			<SortStep bind:step={steps[i]} onchange={refresh} onremove={() => removeStep(i)} />
		{:else if step.kind === 'select'}
			<SelectStep bind:step={steps[i]} onchange={refresh} onremove={() => removeStep(i)} />
		{:else if step.kind === 'take'}
			<TakeStep bind:step={steps[i]} onchange={refresh} onremove={() => removeStep(i)} />
		{/if}
	{/each}
</div>

<div class="add-step">
	<button onclick={() => addStep('filter')}>+ Filter</button>
	<button onclick={() => addStep('sort')}>+ Sort</button>
	<button onclick={() => addStep('select')}>+ Select Columns</button>
	<button onclick={() => addStep('take')}>+ Limit</button>
</div>

<ResultsTable data={result.data} visibleFields={result.visibleFields} total={allTablets.length} />

<style>
	:global(*) { box-sizing: border-box; margin: 0; padding: 0; }

	:global(body) {
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
		padding: 24px;
		background: #f5f5f5;
		color: #222;
	}

	h1 { margin-bottom: 16px; }

	.pipeline { margin-bottom: 20px; }

	.pipeline-source {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		background: #2563eb;
		color: #fff;
		padding: 8px 14px;
		border-radius: 6px;
		font-size: 14px;
		font-weight: 600;
		margin-bottom: 8px;
	}

	.pipeline-source .count {
		font-weight: 400;
		opacity: 0.8;
	}

	.pipe-connector {
		padding: 2px 0 2px 18px;
		color: #999;
		font-size: 18px;
		line-height: 1;
	}

	.add-step {
		margin-top: 8px;
		margin-bottom: 20px;
		display: flex;
		gap: 6px;
	}

	.add-step button {
		padding: 6px 12px;
		font-size: 13px;
		border: 1px dashed #aaa;
		background: #fff;
		border-radius: 4px;
		cursor: pointer;
		color: #555;
	}

	.add-step button:hover {
		border-color: #2563eb;
		color: #2563eb;
	}

	:global(.step) {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		background: #fff;
		border: 1px solid #ddd;
		border-radius: 6px;
		padding: 10px 14px;
		font-size: 14px;
	}

	:global(.step-type) {
		font-weight: 600;
		color: #6b21a8;
		min-width: 60px;
		padding-top: 4px;
	}

	:global(.step-controls) {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
		flex: 1;
	}

	:global(.step-controls select),
	:global(.step-controls input) {
		padding: 4px 8px;
		font-size: 13px;
		border: 1px solid #ccc;
		border-radius: 4px;
	}

	:global(.step-controls input) { width: 160px; }

	:global(.step-remove) {
		background: none;
		border: none;
		color: #999;
		cursor: pointer;
		font-size: 18px;
		padding: 2px 6px;
		line-height: 1;
	}

	:global(.step-remove:hover) { color: #e11d48; }

	:global(.columns-grid) {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 14px;
	}

	:global(.columns-grid label) {
		font-size: 13px;
		display: flex;
		align-items: center;
		gap: 4px;
		cursor: pointer;
	}

	:global(.results-bar) {
		font-size: 14px;
		color: #666;
		margin-bottom: 10px;
	}

	:global(.table-wrap) { overflow-x: auto; }

	:global(table) {
		width: 100%;
		border-collapse: collapse;
		background: #fff;
		font-size: 13px;
	}

	:global(th), :global(td) {
		text-align: left;
		padding: 6px 10px;
		border-bottom: 1px solid #e0e0e0;
		white-space: nowrap;
	}

	:global(th) {
		background: #333;
		color: #fff;
		position: sticky;
		top: 0;
	}

	:global(tr:hover td) { background: #f0f7ff; }

	:global(.dim) { color: #999; }
</style>
