<script lang="ts">
	import { type Step, type FieldDef, executePipeline } from '$lib/pipeline/index.js';
	import FilterStep from '$lib/components/FilterStep.svelte';
	import SortStep from '$lib/components/SortStep.svelte';
	import SelectStep from '$lib/components/SelectStep.svelte';
	import TakeStep from '$lib/components/TakeStep.svelte';
	import ResultsTable from '$lib/components/ResultsTable.svelte';
	import SavedViews from '$lib/components/SavedViews.svelte';

	let {
		title,
		entityType,
		entityLabel,
		data,
		fields,
		fieldGroups,
		defaultColumns,
		defaultView,
		detailBasePath = "",
		defaultFilterField = "Brand",
		defaultSortField = "Brand",
	}: {
		title: string;
		entityType: string;
		entityLabel: string;
		data: any[];
		fields: FieldDef<any>[];
		fieldGroups: string[];
		defaultColumns: string[];
		defaultView: Step[];
		detailBasePath?: string;
		defaultFilterField?: string;
		defaultSortField?: string;
	} = $props();

	let steps: Step[] = $state(JSON.parse(JSON.stringify(defaultView)));
	let tick = $state(0);

	let result = $derived.by(() => {
		void tick;
		return executePipeline(data, steps, fields, defaultColumns);
	});

	function refresh() {
		tick++;
	}

	function addStep(kind: Step['kind']) {
		switch (kind) {
			case 'filter':
				steps.push({ kind: 'filter', field: defaultFilterField, operator: '==', value: '' });
				break;
			case 'sort':
				steps.push({ kind: 'sort', field: defaultSortField, direction: 'asc' });
				break;
			case 'select':
				if (!steps.some((s) => s.kind === 'select')) {
					steps.push({ kind: 'select', fields: [...defaultColumns] });
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
</script>

<h1>{title}</h1>

<slot name="nav" />

<SavedViews {steps} {entityType} {defaultView} onload={loadView} />

<div class="pipeline">
	<div class="pipeline-source">
		{title} <span class="count">({data.length} records)</span>
	</div>

	{#each steps as step, i (i)}
		<div class="pipe-connector">|</div>

		{#if step.kind === 'filter'}
			<FilterStep bind:step={steps[i]} {fields} onchange={refresh} onremove={() => removeStep(i)} />
		{:else if step.kind === 'sort'}
			<SortStep bind:step={steps[i]} {fields} onchange={refresh} onremove={() => removeStep(i)} />
		{:else if step.kind === 'select'}
			<SelectStep bind:step={steps[i]} {fields} {fieldGroups} onchange={refresh} onremove={() => removeStep(i)} />
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

<ResultsTable data={result.data} visibleFields={result.visibleFields} {fields} total={data.length} {entityLabel} {detailBasePath} />

<style>
	h1 { margin-bottom: 8px; }

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
