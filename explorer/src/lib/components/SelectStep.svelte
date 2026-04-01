<script lang="ts">
	import { FIELDS, type SelectStep } from '$lib/pipeline.js';

	let { step, onchange, onremove }: { step: SelectStep; onchange: () => void; onremove: () => void } = $props();

	function toggle(key: string, checked: boolean) {
		if (checked) {
			step.fields = [...step.fields, key];
		} else {
			step.fields = step.fields.filter((k) => k !== key);
		}
		onchange();
	}
</script>

<div class="step">
	<div class="step-type">project</div>
	<div class="step-controls">
		<div class="columns-grid">
			{#each FIELDS as f}
				<label>
					<input
						type="checkbox"
						checked={step.fields.includes(f.key)}
						onchange={(e) => toggle(f.key, (e.target as HTMLInputElement).checked)}
					/>
					{f.label}
				</label>
			{/each}
		</div>
	</div>
	<button class="step-remove" onclick={onremove}>&times;</button>
</div>
