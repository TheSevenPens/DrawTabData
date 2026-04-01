<script lang="ts">
	import { FIELDS, type SortStep } from '$lib/pipeline.js';

	let { step = $bindable(), onchange, onremove }: { step: SortStep; onchange: () => void; onremove: () => void } = $props();
</script>

<div class="step">
	<div class="step-type">sort by</div>
	<div class="step-controls">
		<select value={step.field} onchange={(e) => { step.field = (e.target as HTMLSelectElement).value; onchange(); }}>
			{#each FIELDS as f}
				<option value={f.key} selected={f.key === step.field}>{f.label}</option>
			{/each}
		</select>

		<select value={step.direction} onchange={(e) => { step.direction = (e.target as HTMLSelectElement).value as 'asc' | 'desc'; onchange(); }}>
			<option value="asc" selected={step.direction === 'asc'}>ascending</option>
			<option value="desc" selected={step.direction === 'desc'}>descending</option>
		</select>
	</div>
	<button class="step-remove" onclick={onremove}>&times;</button>
</div>
