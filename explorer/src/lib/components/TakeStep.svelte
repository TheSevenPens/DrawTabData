<script lang="ts">
	import type { TakeStep } from '$lib/pipeline/index.js';

	let { step = $bindable(), onchange, onremove }: { step: TakeStep; onchange: () => void; onremove: () => void } = $props();
</script>

<div class="step">
	<div class="step-type">take</div>
	<div class="step-controls">
		<input
			type="number"
			min="1"
			value={step.count}
			style="width: 80px"
			oninput={(e) => { const n = parseInt((e.target as HTMLInputElement).value, 10); if (n > 0) { step.count = n; onchange(); } }}
		/>
		records
	</div>
	<button class="step-remove" onclick={onremove}>&times;</button>
</div>
