<script lang="ts">
	import { type FieldDef, getFieldDef } from '$lib/pipeline/index.js';

	let { data, visibleFields, fields, total, entityLabel = "records", detailBasePath = "" }: {
		data: any[];
		visibleFields: string[];
		fields: FieldDef<any>[];
		total: number;
		entityLabel?: string;
		detailBasePath?: string;
	} = $props();

	let fieldDefs = $derived(
		visibleFields.map((k) => getFieldDef(k, fields)).filter((f) => f !== undefined)
	);

	function getEntityId(item: any): string {
		return item?.EntityId ?? '';
	}
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
						{#if f.key === 'EntityId' && detailBasePath && val}
							<td><a class="entity-link" href="{detailBasePath}/{encodeURIComponent(val)}">{val}</a></td>
						{:else}
							<td class:dim={!val}>{val}</td>
						{/if}
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.entity-link {
		color: #2563eb;
		text-decoration: none;
	}

	.entity-link:hover {
		text-decoration: underline;
	}
</style>
