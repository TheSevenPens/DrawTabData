import { writable } from 'svelte/store';
import { type UnitPreference, loadUnitPreference, saveUnitPreference } from './units.js';

export const unitPreference = writable<UnitPreference>(loadUnitPreference());

export function toggleUnits() {
  unitPreference.update((current) => {
    const next: UnitPreference = current === 'metric' ? 'imperial' : 'metric';
    saveUnitPreference(next);
    return next;
  });
}
