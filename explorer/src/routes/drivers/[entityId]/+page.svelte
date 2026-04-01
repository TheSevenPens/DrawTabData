<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { loadDrivers } from '../../../../../lib/drawtab-loader.js';
	import { type Driver, DRIVER_FIELDS, DRIVER_FIELD_GROUPS } from '$lib/entities/driver-fields.js';
	import DetailView from '$lib/components/DetailView.svelte';

	let driver: Driver | null = $state(null);
	let notFound = $state(false);

	onMount(async () => {
		const entityId = decodeURIComponent(page.params.entityId);
		const all = (await loadDrivers('')) as Driver[];
		const found = all.find((d) => d.EntityId === entityId);
		if (found) {
			driver = found;
		} else {
			notFound = true;
		}
	});
</script>

{#if notFound}
	<h1>Driver not found</h1>
	<p><a href="/drivers">Back to drivers</a></p>
{:else}
	<h1>{driver?.DriverName ?? 'Loading...'}</h1>
	<DetailView
		item={driver}
		fields={DRIVER_FIELDS}
		fieldGroups={DRIVER_FIELD_GROUPS}
		backHref="/drivers"
		backLabel="Drivers"
	/>
{/if}
