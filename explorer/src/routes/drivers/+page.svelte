<script lang="ts">
	import { onMount } from 'svelte';
	import { loadDrivers } from '../../../../lib/drawtab-loader.js';
	import { type Step, executePipeline } from '$lib/pipeline/index.js';
	import {
		type Driver,
		DRIVER_FIELDS,
		DRIVER_FIELD_GROUPS,
		DRIVER_DEFAULT_COLUMNS,
		DRIVER_DEFAULT_VIEW,
	} from '$lib/entities/driver-fields.js';
	import FilterStep from '$lib/components/FilterStep.svelte';
	import SortStep from '$lib/components/SortStep.svelte';
	import SelectStep from '$lib/components/SelectStep.svelte';
	import TakeStep from '$lib/components/TakeStep.svelte';
	import ResultsTable from '$lib/components/ResultsTable.svelte';
	import SavedViews from '$lib/components/SavedViews.svelte';

	let allDrivers: Driver[] = $state([]);
	let steps: Step[] = $state(JSON.parse(JSON.stringify(DRIVER_DEFAULT_VIEW)));
	let tick = $state(0);

	let result = $derived.by(() => {
		void tick;
		return executePipeline(allDrivers, steps, DRIVER_FIELDS, DRIVER_DEFAULT_COLUMNS);
	});

	function refresh() {
		tick++;
	}

	function addStep(kind: Step['kind']) {
		switch (kind) {
			case 'filter':
				steps.push({ kind: 'filter', field: 'OSFamily', operator: '==', value: '' });
				break;
			case 'sort':
				steps.push({ kind: 'sort', field: 'ReleaseDate', direction: 'desc' });
				break;
			case 'select':
				if (!steps.some((s) => s.kind === 'select')) {
					steps.push({ kind: 'select', fields: [...DRIVER_DEFAULT_COLUMNS] });
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
		allDrivers = (await loadDrivers('')) as Driver[];
	});
</script>

<h1>Drivers</h1>

<p class="back"><a href="/">&larr; Tablets</a></p>

<SavedViews {steps} entityType="drivers" defaultView={DRIVER_DEFAULT_VIEW} onload={loadView} />

<div class="pipeline">
	<div class="pipeline-source">
		Drivers <span class="count">({allDrivers.length} records)</span>
	</div>

	{#each steps as step, i (i)}
		<div class="pipe-connector">|</div>

		{#if step.kind === 'filter'}
			<FilterStep bind:step={steps[i]} fields={DRIVER_FIELDS} onchange={refresh} onremove={() => removeStep(i)} />
		{:else if step.kind === 'sort'}
			<SortStep bind:step={steps[i]} fields={DRIVER_FIELDS} onchange={refresh} onremove={() => removeStep(i)} />
		{:else if step.kind === 'select'}
			<SelectStep bind:step={steps[i]} fields={DRIVER_FIELDS} fieldGroups={DRIVER_FIELD_GROUPS} onchange={refresh} onremove={() => removeStep(i)} />
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

<ResultsTable data={result.data} visibleFields={result.visibleFields} fields={DRIVER_FIELDS} total={allDrivers.length} entityLabel="drivers" detailBasePath="/drivers" />

<style>
	h1 { margin-bottom: 8px; }

	.back {
		margin-bottom: 16px;
		font-size: 14px;
	}

	.back a {
		color: #2563eb;
		text-decoration: none;
	}

	.back a:hover { text-decoration: underline; }

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
</style>
