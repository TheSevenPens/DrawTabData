<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { loadTablets, loadPenCompat, loadPens, type Tablet } from '../../../../../lib/drawtab-loader.js';
	import { TABLET_FIELDS, TABLET_FIELD_GROUPS } from '$lib/entities/tablet-fields.js';
	import { type Pen } from '$lib/entities/pen-fields.js';
	import { type PenCompat } from '$lib/entities/pen-compat-fields.js';
	import DetailView from '$lib/components/DetailView.svelte';

	let tablet: Tablet | null = $state(null);
	let compatiblePens: Pen[] = $state([]);
	let notFound = $state(false);

	onMount(async () => {
		const entityId = decodeURIComponent(page.params.entityId);
		const [allTablets, allCompat, allPens] = await Promise.all([
			loadTablets(''),
			loadPenCompat('') as Promise<PenCompat[]>,
			loadPens('') as Promise<Pen[]>,
		]);

		const found = allTablets.find((t) => t.EntityId === entityId);
		if (!found) {
			notFound = true;
			return;
		}
		tablet = found;

		// Find compatible pen IDs for this tablet's ModelId
		const compatPenIds = new Set(
			allCompat
				.filter((c) => c.TabletId === found.ModelId)
				.map((c) => c.PenId)
		);

		// Match pen IDs to pen records
		compatiblePens = allPens.filter((p) => compatPenIds.has(p.PenId));
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

	{#if tablet}
		<section class="compat-section">
			<h2>Compatible Pens</h2>
			{#if compatiblePens.length > 0}
				<table>
					<thead>
						<tr>
							<th>Pen ID</th>
							<th>Name</th>
							<th>Family</th>
							<th>Year</th>
						</tr>
					</thead>
					<tbody>
						{#each compatiblePens as pen}
							<tr>
								<td><a href="/pens/{encodeURIComponent(pen.EntityId)}">{pen.PenId}</a></td>
								<td>{pen.PenName}</td>
								<td>{pen.PenFamily || ''}</td>
								<td>{pen.PenYear || ''}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{:else}
				<p class="no-data">No pen compatibility data available for this tablet.</p>
			{/if}
		</section>
	{/if}
{/if}

<style>
	.compat-section {
		margin-top: 32px;
	}

	.compat-section h2 {
		font-size: 15px;
		font-weight: 600;
		color: #6b21a8;
		margin-bottom: 8px;
		padding-bottom: 4px;
		border-bottom: 2px solid #e0e0e0;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		background: #fff;
		font-size: 13px;
	}

	th, td {
		text-align: left;
		padding: 6px 10px;
		border-bottom: 1px solid #e0e0e0;
	}

	th {
		background: #333;
		color: #fff;
	}

	tr:hover td { background: #f0f7ff; }

	td a {
		color: #2563eb;
		text-decoration: none;
	}

	td a:hover { text-decoration: underline; }

	.no-data {
		font-size: 13px;
		color: #999;
		font-style: italic;
	}
</style>
