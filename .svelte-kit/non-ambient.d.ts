
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	type MatcherParam<M> = M extends (param : string) => param is (infer U extends string) ? U : string;

	export interface AppTypes {
		RouteId(): "/" | "/drivers" | "/drivers/[entityId]" | "/pen-compat" | "/pen-families" | "/pen-families/[entityId]" | "/pens" | "/pens/[entityId]" | "/tablet-families" | "/tablet-families/[entityId]" | "/tablets" | "/tablets/[entityId]";
		RouteParams(): {
			"/drivers/[entityId]": { entityId: string };
			"/pen-families/[entityId]": { entityId: string };
			"/pens/[entityId]": { entityId: string };
			"/tablet-families/[entityId]": { entityId: string };
			"/tablets/[entityId]": { entityId: string }
		};
		LayoutParams(): {
			"/": { entityId?: string };
			"/drivers": { entityId?: string };
			"/drivers/[entityId]": { entityId: string };
			"/pen-compat": Record<string, never>;
			"/pen-families": { entityId?: string };
			"/pen-families/[entityId]": { entityId: string };
			"/pens": { entityId?: string };
			"/pens/[entityId]": { entityId: string };
			"/tablet-families": { entityId?: string };
			"/tablet-families/[entityId]": { entityId: string };
			"/tablets": { entityId?: string };
			"/tablets/[entityId]": { entityId: string }
		};
		Pathname(): "/" | "/drivers" | `/drivers/${string}` & {} | "/pen-compat" | "/pen-families" | `/pen-families/${string}` & {} | "/pens" | `/pens/${string}` & {} | "/tablet-families" | `/tablet-families/${string}` & {} | `/tablets/${string}` & {};
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/drivers/WACOM-drivers.json" | "/pen-compat/WACOM-pen-compat.json" | "/pen-families/WACOM-pen-families.json" | "/pens/WACOM-pens.json" | "/tablet-families/WACOM-tablet-families.json" | "/tablets/HUION-tablets.json" | "/tablets/WACOM-tablets.json" | "/tablets/XENCELABS-tablets.json" | "/tablets/XPPEN-tablets.json" | string & {};
	}
}