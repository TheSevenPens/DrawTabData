<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { loadTablets, type Tablet } from '../../../../../lib/drawtab-loader.js';
	import { TABLET_FIELDS, TABLET_FIELD_GROUPS } from '$lib/entities/tablet-fields.js';
	import DetailView from '$lib/components/DetailView.svelte';

	let tablet: Tablet | null = $state(null);
	let notFound = $state(false);

	onMount(async () => {
		const entityId = decodeURIComponent(page.params.entityId);
		const all = await loadTablets('');
		const found = all.find((t) => t.EntityId === entityId);
		if (found) {
			tablet = found;
		} else {
			notFound = true;
		}
	});
</script>

{#if notFound}
	<h1>Tablet not found</h1>
	<p><a href="/">Back to tablets</a></p>
{:else}
	<h1>{tablet?.ModelName ?? 'Loading...'}</h1>
	<DetailView
		item={tablet}
		fields={TABLET_FIELDS}
		fieldGroups={TABLET_FIELD_GROUPS}
		backHref="/"
		backLabel="Tablets"
	/>
{/if}
