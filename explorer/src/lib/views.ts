import type { Step } from './pipeline/types.js';

export interface SavedView {
  name: string;
  steps: Step[];
}

const LEGACY_KEY = 'drawtabdata-views';

function getStorageKey(entityType: string): string {
  return `drawtabdata-views-${entityType}`;
}

function migrate(entityType: string) {
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      localStorage.setItem(getStorageKey(entityType), legacy);
      localStorage.removeItem(LEGACY_KEY);
    }
  } catch {}
}

export function loadViews(entityType: string): SavedView[] {
  migrate(entityType);
  try {
    const raw = localStorage.getItem(getStorageKey(entityType));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persist(entityType: string, views: SavedView[]) {
  localStorage.setItem(getStorageKey(entityType), JSON.stringify(views));
}

export function saveView(entityType: string, name: string, steps: Step[]): void {
  const views = loadViews(entityType);
  const existing = views.findIndex((v) => v.name === name);
  const entry: SavedView = { name, steps: JSON.parse(JSON.stringify(steps)) };
  if (existing >= 0) {
    views[existing] = entry;
  } else {
    views.push(entry);
  }
  persist(entityType, views);
}

export function deleteView(entityType: string, name: string): void {
  const views = loadViews(entityType).filter((v) => v.name !== name);
  persist(entityType, views);
}

export function renameView(entityType: string, oldName: string, newName: string): void {
  const views = loadViews(entityType);
  const view = views.find((v) => v.name === oldName);
  if (view) {
    view.name = newName;
  }
  persist(entityType, views);
}
