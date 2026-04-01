<script lang="ts">
	import { onMount } from 'svelte';
	import { loadPenCompat } from '../../../../lib/drawtab-loader.js';
	import { type PenCompat, PEN_COMPAT_FIELDS, PEN_COMPAT_FIELD_GROUPS, PEN_COMPAT_DEFAULT_COLUMNS, PEN_COMPAT_DEFAULT_VIEW } from '$lib/entities/pen-compat-fields.js';
	import EntityExplorer from '$lib/components/EntityExplorer.svelte';
	import Nav from '$lib/components/Nav.svelte';

	let data: PenCompat[] = $state([]);

	onMount(async () => {
		data = (await loadPenCompat('')) as PenCompat[];
	});
</script>

<Nav />
<EntityExplorer
	title="Pen Compatibility"
	entityType="pen-compat"
	entityLabel="compatibility rows"
	{data}
	fields={PEN_COMPAT_FIELDS}
	fieldGroups={PEN_COMPAT_FIELD_GROUPS}
	defaultColumns={PEN_COMPAT_DEFAULT_COLUMNS}
	defaultView={PEN_COMPAT_DEFAULT_VIEW}
	defaultFilterField="TabletId"
	defaultSortField="TabletId"
/>
