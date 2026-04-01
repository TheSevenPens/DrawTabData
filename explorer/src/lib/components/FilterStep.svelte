<script lang="ts">
	import { FIELDS, getFieldDef, getOperatorsForField, type FilterStep } from '$lib/pipeline.js';

	let { step, onchange, onremove }: { step: FilterStep; onchange: () => void; onremove: () => void } = $props();

	let fieldDef = $derived(getFieldDef(step.field));
	let operators = $derived(fieldDef ? getOperatorsForField(fieldDef) : []);
	let needsValue = $derived(step.operator !== 'empty' && step.operator !== 'notempty');

	function onFieldChange(e: Event) {
		step.field = (e.target as HTMLSelectElement).value;
		const newDef = getFieldDef(step.field);
		const ops = newDef ? getOperatorsForField(newDef) : [];
		if (!ops.some((o) => o.value === step.operator)) {
			step.operator = ops[0]?.value ?? '==';
		}
		step.value = '';
		onchange();
	}

	function onOpChange(e: Event) {
		step.operator = (e.target as HTMLSelectElement).value;
		onchange();
	}

	function onValueChange(e: Event) {
		step.value = (e.target as HTMLSelectElement | HTMLInputElement).value;
		onchange();
	}
</script>

<div class="step">
	<div class="step-type">where</div>
	<div class="step-controls">
		<select value={step.field} onchange={onFieldChange}>
			{#each FIELDS as f}
				<option value={f.key} selected={f.key === step.field}>{f.label}</option>
			{/each}
		</select>

		<select value={step.operator} onchange={onOpChange}>
			{#each operators as op}
				<option value={op.value} selected={op.value === step.operator}>{op.label}</option>
			{/each}
		</select>

		{#if needsValue && fieldDef?.type === 'enum' && fieldDef.enumValues}
			<select value={step.value} onchange={onValueChange}>
				<option value="">-- select --</option>
				{#each fieldDef.enumValues as v}
					<option value={v} selected={v === step.value}>{v}</option>
				{/each}
			</select>
		{:else if needsValue}
			<input
				type={fieldDef?.type === 'number' ? 'number' : 'text'}
				placeholder="value..."
				value={step.value}
				oninput={onValueChange}
			/>
		{/if}
	</div>
	<button class="step-remove" onclick={onremove}>&times;</button>
</div>
