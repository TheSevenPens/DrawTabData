<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { loadTabletFamilies } from '../../../../../lib/drawtab-loader.js';
	import { type TabletFamily, TABLET_FAMILY_FIELDS, TABLET_FAMILY_FIELD_GROUPS } from '$lib/entities/tablet-family-fields.js';
	import DetailView from '$lib/components/DetailView.svelte';

	let item: TabletFamily | null = $state(null);
	let notFound = $state(false);

	onMount(async () => {
		const entityId = decodeURIComponent(page.params.entityId);
		const all = (await loadTabletFamilies('')) as TabletFamily[];
		const found = all.find((f) => f.EntityId === entityId);
		if (found) { item = found; } else { notFound = true; }
	});
</script>

{#if notFound}
	<h1>Tablet family not found</h1>
	<p><a href="/tablet-families">Back to tablet families</a></p>
{:else}
	<h1>{item?.FamilyName ?? 'Loading...'}</h1>
	<DetailView item={item} fields={TABLET_FAMILY_FIELDS} fieldGroups={TABLET_FAMILY_FIELD_GROUPS} backHref="/tablet-families" backLabel="Tablet Families" />
{/if}
