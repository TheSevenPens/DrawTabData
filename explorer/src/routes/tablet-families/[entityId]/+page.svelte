<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { loadTabletFamilies, loadTablets, type Tablet } from '../../../../../lib/drawtab-loader.js';
	import { type TabletFamily, TABLET_FAMILY_FIELDS, TABLET_FAMILY_FIELD_GROUPS } from '$lib/entities/tablet-family-fields.js';
	import DetailView from '$lib/components/DetailView.svelte';

	let item: TabletFamily | null = $state(null);
	let familyTablets: Tablet[] = $state([]);
	let notFound = $state(false);

	onMount(async () => {
		const entityId = decodeURIComponent(page.params.entityId);
		const [allFamilies, allTablets] = await Promise.all([
			loadTabletFamilies('') as Promise<TabletFamily[]>,
			loadTablets(''),
		]);

		const found = allFamilies.find((f) => f.EntityId === entityId);
		if (!found) {
			notFound = true;
			return;
		}
		item = found;

		familyTablets = allTablets.filter((t) => t.ModelFamily === found.FamilyId);
	});
</script>

{#if notFound}
	<h1>Tablet family not found</h1>
	<p><a href="/tablet-families">Back to tablet families</a></p>
{:else}
	<h1>{item?.FamilyName ?? 'Loading...'}</h1>

	<DetailView item={item} fields={TABLET_FAMILY_FIELDS} fieldGroups={TABLET_FAMILY_FIELD_GROUPS} backHref="/tablet-families" backLabel="Tablet Families" />

	{#if item}
		<section class="family-section">
			<h2>Tablets in this Family</h2>
			{#if familyTablets.length > 0}
				<table>
					<thead>
						<tr>
							<th>Model ID</th>
							<th>Name</th>
							<th>Type</th>
							<th>Year</th>
							<th>Status</th>
						</tr>
					</thead>
					<tbody>
						{#each familyTablets as tablet}
							<tr>
								<td><a href="/tablets/{encodeURIComponent(tablet.EntityId)}">{tablet.ModelId}</a></td>
								<td>{tablet.ModelName}</td>
								<td>{tablet.ModelType}</td>
								<td>{tablet.ModelLaunchYear || ''}</td>
								<td>{tablet.ModelStatus || ''}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{:else}
				<p class="no-data">No tablets found in this family.</p>
			{/if}
		</section>
	{/if}
{/if}

<style>
	.family-section {
		margin-top: 32px;
	}

	.family-section h2 {
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
