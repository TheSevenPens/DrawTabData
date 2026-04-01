<script lang="ts">
	import { onMount } from 'svelte';
	import { loadPens } from '../../../../lib/drawtab-loader.js';
	import { type Pen, PEN_FIELDS, PEN_FIELD_GROUPS, PEN_DEFAULT_COLUMNS, PEN_DEFAULT_VIEW } from '$lib/entities/pen-fields.js';
	import EntityExplorer from '$lib/components/EntityExplorer.svelte';
	import Nav from '$lib/components/Nav.svelte';

	let data: Pen[] = $state([]);

	onMount(async () => {
		data = (await loadPens('')) as Pen[];
	});
</script>

<Nav />
<EntityExplorer
	title="Pens"
	entityType="pens"
	entityLabel="pens"
	{data}
	fields={PEN_FIELDS}
	fieldGroups={PEN_FIELD_GROUPS}
	defaultColumns={PEN_DEFAULT_COLUMNS}
	defaultView={PEN_DEFAULT_VIEW}
	detailBasePath="/pens"
	defaultFilterField="PenFamily"
	defaultSortField="PenId"
/>
