<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { loadPens, loadPenCompat, loadTablets, type Tablet } from '../../../../../lib/drawtab-loader.js';
	import { type Pen, PEN_FIELDS, PEN_FIELD_GROUPS } from '$lib/entities/pen-fields.js';
	import { type PenCompat } from '$lib/entities/pen-compat-fields.js';
	import DetailView from '$lib/components/DetailView.svelte';

	let pen: Pen | null = $state(null);
	let compatibleTablets: Tablet[] = $state([]);
	let includedWithTablets: Tablet[] = $state([]);
	let notFound = $state(false);

	onMount(async () => {
		const entityId = decodeURIComponent(page.params.entityId);
		const [allPens, allCompat, allTablets] = await Promise.all([
			loadPens('') as Promise<Pen[]>,
			loadPenCompat('') as Promise<PenCompat[]>,
			loadTablets(''),
		]);

		const found = allPens.find((p) => p.EntityId === entityId);
		if (!found) {
			notFound = true;
			return;
		}
		pen = found;

		const compatTabletIds = new Set(
			allCompat
				.filter((c) => c.PenId === found.PenId)
				.map((c) => c.TabletId)
		);

		compatibleTablets = allTablets.filter((t) => compatTabletIds.has(t.ModelId));

		// Find tablets that include this pen
		includedWithTablets = allTablets.filter((t) => {
			const included = t.ModelIncludedPen ?? '';
			return included.split(',').some((p) => p.trim() === found.PenId);
		});
	});
</script>

{#if notFound}
	<h1>Pen not found</h1>
	<p><a href="/pens">Back to pens</a></p>
{:else}
	<h1>{pen?.PenName ?? 'Loading...'}</h1>

	<DetailView item={pen} fields={PEN_FIELDS} fieldGroups={PEN_FIELD_GROUPS} backHref="/pens" backLabel="Pens" />

	{#if pen}
		<section class="compat-section">
			<h2>Compatible Tablets</h2>
			{#if compatibleTablets.length > 0}
				<table>
					<thead>
						<tr>
							<th>Model ID</th>
							<th>Name</th>
							<th>Type</th>
							<th>Year</th>
						</tr>
					</thead>
					<tbody>
						{#each compatibleTablets as tablet}
							<tr>
								<td><a href="/tablets/{encodeURIComponent(tablet.EntityId)}">{tablet.ModelId}</a></td>
								<td>{tablet.ModelName}</td>
								<td>{tablet.ModelType}</td>
								<td>{tablet.ModelLaunchYear || ''}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{:else}
				<p class="no-data">No tablet compatibility data available for this pen.</p>
			{/if}
		</section>

		<section class="compat-section">
			<h2>Included With Tablets</h2>
			{#if includedWithTablets.length > 0}
				<table>
					<thead>
						<tr>
							<th>Model ID</th>
							<th>Name</th>
							<th>Type</th>
							<th>Year</th>
						</tr>
					</thead>
					<tbody>
						{#each includedWithTablets as tablet}
							<tr>
								<td><a href="/tablets/{encodeURIComponent(tablet.EntityId)}">{tablet.ModelId}</a></td>
								<td>{tablet.ModelName}</td>
								<td>{tablet.ModelType}</td>
								<td>{tablet.ModelLaunchYear || ''}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{:else}
				<p class="no-data">No tablets list this pen as included.</p>
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
