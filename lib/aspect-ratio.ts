// Aspect ratio categorization.
//
// Buckets a (width, height) pair into one of a small set of named
// categories, e.g. "16X9_EXACT", "16X10_VERYCLOSE", or "OTHER".
//
// The width/height inputs can be in any orientation — the function
// always normalizes by dividing the longer side by the shorter side
// before comparing, so a portrait-oriented panel categorizes the same
// as a landscape one.

interface PopularRatio {
	name: string;
	ratio: number;
}

/**
 * Popular aspect ratios checked when categorizing. Order matters when
 * two targets are equidistant from a measured ratio: earlier entries
 * win the tie. The order below prefers the more common ratio first.
 */
export const POPULAR_RATIOS: ReadonlyArray<PopularRatio> = [
	{ name: "16X9", ratio: 16 / 9 },     // ~1.778
	{ name: "16X10", ratio: 16 / 10 },   // 1.6
	{ name: "3X2", ratio: 3 / 2 },       // 1.5
	{ name: "4X3", ratio: 4 / 3 },       // ~1.333
	{ name: "5X4", ratio: 5 / 4 },       // 1.25
	{ name: "1X1", ratio: 1 },           // 1
];

/** Absolute |actual − target| ≤ 0.005 (≈ 0.3% off): panel was spec'd to that ratio. */
export const EXACT_THRESHOLD = 0.005;
/** ≤ 0.02 (≈ 1.2% off): engineered to that ratio with rounding noise. */
export const VERYCLOSE_THRESHOLD = 0.02;
/** ≤ 0.05 (≈ 3% off): "in the spirit of" but the panel isn't exactly there. */
export const CLOSE_THRESHOLD = 0.05;

/**
 * The full ordered list of categories. Useful for sorting tabular UIs
 * by category (so all 16X9_* values appear together, then 16X10_*, etc.)
 * and for populating a `FieldDef.enumValues` for filtering.
 */
export const ASPECT_RATIO_CATEGORIES: ReadonlyArray<string> = [
	...POPULAR_RATIOS.flatMap((r) => [
		`${r.name}_EXACT`,
		`${r.name}_VERYCLOSE`,
		`${r.name}_CLOSE`,
	]),
	"OTHER",
];

/**
 * Categorize a (width, height) into one of the aspect-ratio buckets.
 * Returns `null` if the inputs are missing or non-positive.
 *
 * Tie-breaking: when two popular ratios are equidistant from the
 * measured ratio, the one earlier in `POPULAR_RATIOS` wins.
 */
export function aspectRatioCategory(
	width: number | null | undefined,
	height: number | null | undefined,
): string | null {
	if (width == null || height == null) return null;
	if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
	if (width <= 0 || height <= 0) return null;

	const ratio = Math.max(width, height) / Math.min(width, height);

	let bestName: string | null = null;
	let bestDiff = Infinity;
	for (const r of POPULAR_RATIOS) {
		const d = Math.abs(ratio - r.ratio);
		if (d < bestDiff) {
			bestDiff = d;
			bestName = r.name;
		}
	}
	if (bestName == null) return "OTHER";

	if (bestDiff <= EXACT_THRESHOLD) return `${bestName}_EXACT`;
	if (bestDiff <= VERYCLOSE_THRESHOLD) return `${bestName}_VERYCLOSE`;
	if (bestDiff <= CLOSE_THRESHOLD) return `${bestName}_CLOSE`;
	return "OTHER";
}
