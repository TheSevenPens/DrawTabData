<script lang="ts">
	import type { FieldDef, SelectStep } from '$lib/pipeline/index.js';

	let { step = $bindable(), fields, fieldGroups, onchange, onremove }: {
		step: SelectStep;
		fields: FieldDef<any>[];
		fieldGroups: string[];
		onchange: () => void;
		onremove: () => void;
	} = $props();

	function toggle(key: string, checked: boolean) {
		if (checked) {
			step.fields = [...step.fields, key];
		} else {
			step.fields = step.fields.filter((k) => k !== key);
		}
		onchange();
	}

	function toggleGroup(group: string, checked: boolean) {
		const groupKeys = fields.filter((f) => f.group === group).map((f) => f.key);
		if (checked) {
			const toAdd = groupKeys.filter((k) => !step.fields.includes(k));
			step.fields = [...step.fields, ...toAdd];
		} else {
			step.fields = step.fields.filter((k) => !groupKeys.includes(k));
		}
		onchange();
	}

	function isGroupChecked(group: string): boolean {
		const groupKeys = fields.filter((f) => f.group === group).map((f) => f.key);
		return groupKeys.every((k) => step.fields.includes(k));
	}

	function isGroupIndeterminate(group: string): boolean {
		const groupKeys = fields.filter((f) => f.group === group).map((f) => f.key);
		const count = groupKeys.filter((k) => step.fields.includes(k)).length;
		return count > 0 && count < groupKeys.length;
	}
</script>

<div class="step">
	<div class="step-type">project</div>
	<div class="step-controls">
		<div class="columns-groups">
			{#each fieldGroups as group}
				{@const checked = isGroupChecked(group)}
				{@const indeterminate = isGroupIndeterminate(group)}
				<div class="column-group">
					<label class="group-header">
						<input
							type="checkbox"
							{checked}
							indeterminate={indeterminate}
							onchange={(e) => toggleGroup(group, (e.target as HTMLInputElement).checked)}
						/>
						<strong>{group}</strong>
					</label>
					<div class="group-fields">
						{#each fields.filter((f) => f.group === group) as f}
							<label>
								<input
									type="checkbox"
									checked={step.fields.includes(f.key)}
									onchange={(e) => toggle(f.key, (e.target as HTMLInputElement).checked)}
								/>
								{f.label}
							</label>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</div>
	<button class="step-remove" onclick={onremove}>&times;</button>
</div>

<style>
	.columns-groups {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
	}

	.column-group {
		min-width: 150px;
	}

	.group-header {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 13px;
		cursor: pointer;
		margin-bottom: 4px;
		padding-bottom: 4px;
		border-bottom: 1px solid #e0e0e0;
	}

	.group-fields {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding-left: 4px;
	}

	.group-fields label {
		font-size: 13px;
		display: flex;
		align-items: center;
		gap: 4px;
		cursor: pointer;
	}
</style>
