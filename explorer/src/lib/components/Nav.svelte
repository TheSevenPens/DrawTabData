<script lang="ts">
	import { page } from '$app/state';
	import { unitPreference, toggleUnits } from '$lib/unit-store.js';

	const links = [
		{ href: '/', label: 'Tablets' },
		{ href: '/pens', label: 'Pens' },
		{ href: '/pen-families', label: 'Pen Families' },
		{ href: '/tablet-families', label: 'Tablet Families' },
		{ href: '/pen-compat', label: 'Pen Compat' },
		{ href: '/drivers', label: 'Drivers' },
	];
</script>

<nav>
	<div class="nav-links">
		{#each links as link}
			<a href={link.href} class:active={page.url.pathname === link.href}>{link.label}</a>
		{/each}
	</div>
	<button class="unit-toggle" onclick={toggleUnits}>
		{$unitPreference === 'metric' ? 'Metric' : 'Imperial'}
	</button>
</nav>

<style>
	nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 16px;
		flex-wrap: wrap;
		gap: 8px;
	}

	.nav-links {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}

	a {
		padding: 5px 12px;
		font-size: 13px;
		border: 1px solid #ddd;
		border-radius: 4px;
		color: #555;
		text-decoration: none;
		background: #fff;
	}

	a:hover {
		border-color: #2563eb;
		color: #2563eb;
	}

	a.active {
		background: #2563eb;
		color: #fff;
		border-color: #2563eb;
	}

	.unit-toggle {
		padding: 5px 12px;
		font-size: 13px;
		border: 1px solid #16a34a;
		border-radius: 4px;
		background: #fff;
		color: #16a34a;
		cursor: pointer;
		font-weight: 600;
	}

	.unit-toggle:hover {
		background: #16a34a;
		color: #fff;
	}
</style>
