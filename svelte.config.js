import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({ fallback: 'index.html' }),
		files: {
			routes: 'explorer/src/routes',
			lib: 'explorer/src/lib',
			appTemplate: 'explorer/src/app.html',
			assets: 'explorer/static',
		},
	},
};

export default config;
