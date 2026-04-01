<script lang="ts">
	import { page } from '$app/state';

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
	{#each links as link}
		<a href={link.href} class:active={page.url.pathname === link.href}>{link.label}</a>
	{/each}
</nav>

<style>
	nav {
		display: flex;
		gap: 4px;
		margin-bottom: 16px;
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
</style>
