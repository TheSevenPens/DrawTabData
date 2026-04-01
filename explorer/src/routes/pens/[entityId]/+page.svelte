<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { loadPens } from '../../../../../lib/drawtab-loader.js';
	import { type Pen, PEN_FIELDS, PEN_FIELD_GROUPS } from '$lib/entities/pen-fields.js';
	import DetailView from '$lib/components/DetailView.svelte';

	let item: Pen | null = $state(null);
	let notFound = $state(false);

	onMount(async () => {
		const entityId = decodeURIComponent(page.params.entityId);
		const all = (await loadPens('')) as Pen[];
		const found = all.find((p) => p.EntityId === entityId);
		if (found) { item = found; } else { notFound = true; }
	});
</script>

{#if notFound}
	<h1>Pen not found</h1>
	<p><a href="/pens">Back to pens</a></p>
{:else}
	<h1>{item?.PenName ?? 'Loading...'}</h1>
	<DetailView item={item} fields={PEN_FIELDS} fieldGroups={PEN_FIELD_GROUPS} backHref="/pens" backLabel="Pens" />
{/if}
