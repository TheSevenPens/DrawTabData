<script lang="ts">
	import { onMount } from 'svelte';
	import { loadTablets, type Tablet } from '../../../lib/drawtab-loader.js';
	import {
		TABLET_FIELDS,
		TABLET_FIELD_GROUPS,
		TABLET_DEFAULT_COLUMNS,
		TABLET_DEFAULT_VIEW,
	} from '$lib/entities/tablet-fields.js';
	import EntityExplorer from '$lib/components/EntityExplorer.svelte';
	import Nav from '$lib/components/Nav.svelte';

	let data: Tablet[] = $state([]);

	onMount(async () => {
		data = await loadTablets('');
	});
</script>

<Nav />
<EntityExplorer
	title="Tablets"
	entityType="tablets"
	entityLabel="tablets"
	{data}
	fields={TABLET_FIELDS}
	fieldGroups={TABLET_FIELD_GROUPS}
	defaultColumns={TABLET_DEFAULT_COLUMNS}
	defaultView={TABLET_DEFAULT_VIEW}
	detailBasePath="/tablets"
	defaultFilterField="Brand"
	defaultSortField="Brand"
/>

<style>
	:global(*) { box-sizing: border-box; margin: 0; padding: 0; }

	:global(body) {
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
		padding: 24px;
		background: #f5f5f5;
		color: #222;
	}

	:global(.step) {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		background: #fff;
		border: 1px solid #ddd;
		border-radius: 6px;
		padding: 10px 14px;
		font-size: 14px;
	}

	:global(.step-type) {
		font-weight: 600;
		color: #6b21a8;
		min-width: 60px;
		padding-top: 4px;
	}

	:global(.step-controls) {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
		flex: 1;
	}

	:global(.step-controls select),
	:global(.step-controls input) {
		padding: 4px 8px;
		font-size: 13px;
		border: 1px solid #ccc;
		border-radius: 4px;
	}

	:global(.step-controls input) { width: 160px; }

	:global(.step-remove) {
		background: none;
		border: none;
		color: #999;
		cursor: pointer;
		font-size: 18px;
		padding: 2px 6px;
		line-height: 1;
	}

	:global(.step-remove:hover) { color: #e11d48; }

	:global(.pipe-connector) {
		padding: 2px 0 2px 18px;
		color: #999;
		font-size: 18px;
		line-height: 1;
	}

	:global(.results-bar) {
		font-size: 14px;
		color: #666;
		margin-bottom: 10px;
	}

	:global(.table-wrap) { overflow-x: auto; }

	:global(table) {
		width: 100%;
		border-collapse: collapse;
		background: #fff;
		font-size: 13px;
	}

	:global(th), :global(td) {
		text-align: left;
		padding: 6px 10px;
		border-bottom: 1px solid #e0e0e0;
		white-space: nowrap;
	}

	:global(th) {
		background: #333;
		color: #fff;
		position: sticky;
		top: 0;
	}

	:global(tr:hover td) { background: #f0f7ff; }

	:global(.dim) { color: #999; }
</style>
