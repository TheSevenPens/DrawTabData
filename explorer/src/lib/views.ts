import type { Step } from './pipeline.js';

export interface SavedView {
  name: string;
  steps: Step[];
}

const STORAGE_KEY = 'drawtabdata-views';

export function loadViews(): SavedView[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persist(views: SavedView[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
}

export function saveView(name: string, steps: Step[]): SavedView[] {
  const views = loadViews();
  const existing = views.findIndex((v) => v.name === name);
  const entry: SavedView = { name, steps: JSON.parse(JSON.stringify(steps)) };
  if (existing >= 0) {
    views[existing] = entry;
  } else {
    views.push(entry);
  }
  persist(views);
  return views;
}

export function deleteView(name: string): SavedView[] {
  const views = loadViews().filter((v) => v.name !== name);
  persist(views);
  return views;
}

export function renameView(oldName: string, newName: string): SavedView[] {
  const views = loadViews();
  const view = views.find((v) => v.name === oldName);
  if (view) {
    view.name = newName;
  }
  persist(views);
  return views;
}
