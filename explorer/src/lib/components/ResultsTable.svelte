<script lang="ts">
	import type { Tablet } from '../../../../lib/drawtab-loader.js';
	import { getFieldDef } from '$lib/pipeline.js';

	let { data, visibleFields, total }: { data: Tablet[]; visibleFields: string[]; total: number } = $props();

	let fieldDefs = $derived(
		visibleFields.map((k) => getFieldDef(k)).filter((f) => f !== undefined)
	);
</script>

<div class="results-bar">
	Showing {data.length} of {total} tablets
</div>

<div class="table-wrap">
	<table>
		<thead>
			<tr>
				{#each fieldDefs as f}
					<th>{f.label}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each data as tablet}
				<tr>
					{#each fieldDefs as f}
						{@const val = f.getValue(tablet)}
						<td class:dim={!val}>{val}</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>
