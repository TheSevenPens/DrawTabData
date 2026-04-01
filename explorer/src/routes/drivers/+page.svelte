<script lang="ts">
	import { onMount } from 'svelte';
	import { loadDrivers } from '../../../../lib/drawtab-loader.js';
	import { type Driver, DRIVER_FIELDS, DRIVER_FIELD_GROUPS, DRIVER_DEFAULT_COLUMNS, DRIVER_DEFAULT_VIEW } from '$lib/entities/driver-fields.js';
	import EntityExplorer from '$lib/components/EntityExplorer.svelte';
	import Nav from '$lib/components/Nav.svelte';

	let data: Driver[] = $state([]);

	onMount(async () => {
		data = (await loadDrivers('')) as Driver[];
	});
</script>

<Nav />
<EntityExplorer
	title="Drivers"
	entityType="drivers"
	entityLabel="drivers"
	{data}
	fields={DRIVER_FIELDS}
	fieldGroups={DRIVER_FIELD_GROUPS}
	defaultColumns={DRIVER_DEFAULT_COLUMNS}
	defaultView={DRIVER_DEFAULT_VIEW}
	detailBasePath="/drivers"
	defaultFilterField="OSFamily"
	defaultSortField="ReleaseDate"
/>
