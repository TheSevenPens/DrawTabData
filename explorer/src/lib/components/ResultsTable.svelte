<script lang="ts">
	import { type FieldDef, getFieldDef } from '$lib/pipeline/index.js';

	let { data, visibleFields, fields, total, entityLabel = "records" }: {
		data: any[];
		visibleFields: string[];
		fields: FieldDef<any>[];
		total: number;
		entityLabel?: string;
	} = $props();

	let fieldDefs = $derived(
		visibleFields.map((k) => getFieldDef(k, fields)).filter((f) => f !== undefined)
	);
</script>

<div class="results-bar">
	Showing {data.length} of {total} {entityLabel}
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
			{#each data as item}
				<tr>
					{#each fieldDefs as f}
						{@const val = f.getValue(item)}
						<td class:dim={!val}>{val}</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>
