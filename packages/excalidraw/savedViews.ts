import {
  MAX_SAVED_VIEWS,
  SAVED_VIEW_NAME_MAX_LENGTH,
  randomId,
} from "@excalidraw/common";

import type { AppState, SavedView } from "./types";
import type { AnimationOptions, SetViewportOptions } from "./viewport";

type ViewportState = Pick<
  AppState,
  "scrollX" | "scrollY" | "zoom" | "width" | "height"
>;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/**
 * Collapses whitespace and clamps the length. Returns an empty string for
 * names that contain nothing but whitespace.
 */
export const normalizeSavedViewName = (name: string): string =>
  name.replace(/\s+/g, " ").trim().slice(0, SAVED_VIEW_NAME_MAX_LENGTH);

/** The scene-coordinate area currently visible in the viewport. */
export const getVisibleSceneArea = (
  appState: ViewportState,
): Pick<SavedView, "x" | "y" | "width" | "height"> => {
  const zoom = appState.zoom.value;
  return {
    x: -appState.scrollX,
    y: -appState.scrollY,
    width: appState.width / zoom,
    height: appState.height / zoom,
  };
};

/**
 * Picks the first "View N" name that isn't taken yet, so that repeatedly
 * saving without naming doesn't produce duplicates.
 */
export const getNextSavedViewName = (
  savedViews: readonly SavedView[],
  prefix: string,
): string => {
  const taken = new Set(savedViews.map((view) => view.name));
  let index = savedViews.length + 1;
  while (taken.has(`${prefix} ${index}`)) {
    index++;
  }
  return `${prefix} ${index}`;
};

/** Uses the given name if it has any content, a "View N" default otherwise. */
export const resolveSavedViewName = (
  savedViews: readonly SavedView[],
  name: string | null | undefined,
  defaultPrefix: string,
): string =>
  normalizeSavedViewName(name ?? "") ||
  getNextSavedViewName(savedViews, defaultPrefix);

export const canAddSavedView = (savedViews: readonly SavedView[]) =>
  savedViews.length < MAX_SAVED_VIEWS;

/** false until the editor has been measured (zero-sized viewport) */
export const canSaveViewport = (appState: ViewportState) =>
  appState.width > 0 && appState.height > 0;

export const createSavedView = (
  appState: ViewportState,
  name: string,
): SavedView => ({
  id: randomId(),
  name,
  ...getVisibleSceneArea(appState),
});

export const getSavedView = (
  savedViews: readonly SavedView[],
  id: string,
): SavedView | null => savedViews.find((view) => view.id === id) ?? null;

/**
 * `contain` so that the saved area is shown in full even if the window is now
 * smaller or larger than when the view was saved.
 */
export const getSavedViewViewportOptions = (
  savedView: SavedView,
  animation: AnimationOptions | boolean = true,
): SetViewportOptions => ({
  target: {
    x: savedView.x,
    y: savedView.y,
    width: savedView.width,
    height: savedView.height,
  },
  fit: "contain",
  animation,
});

export const renameSavedView = (
  savedViews: readonly SavedView[],
  id: string,
  name: string,
): readonly SavedView[] => {
  const nextName = normalizeSavedViewName(name);
  if (!nextName) {
    return savedViews;
  }
  let changed = false;
  const nextSavedViews = savedViews.map((view) => {
    if (view.id !== id || view.name === nextName) {
      return view;
    }
    changed = true;
    return { ...view, name: nextName };
  });
  return changed ? nextSavedViews : savedViews;
};

export const removeSavedView = (
  savedViews: readonly SavedView[],
  id: string,
): readonly SavedView[] => {
  const nextSavedViews = savedViews.filter((view) => view.id !== id);
  return nextSavedViews.length === savedViews.length
    ? savedViews
    : nextSavedViews;
};

/**
 * Validates saved views coming from untrusted sources (files, share links,
 * browser storage). Malformed entries are dropped, names normalized, ids
 * deduplicated and the list is capped at {@link MAX_SAVED_VIEWS}.
 */
export const restoreSavedViews = (value: unknown): SavedView[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const ids = new Set<string>();
  const savedViews: SavedView[] = [];

  for (const view of value) {
    if (savedViews.length >= MAX_SAVED_VIEWS) {
      break;
    }
    if (!view || typeof view !== "object") {
      continue;
    }
    const { id, name, x, y, width, height } = view as Record<string, unknown>;
    if (
      typeof id !== "string" ||
      !id ||
      ids.has(id) ||
      typeof name !== "string" ||
      !isFiniteNumber(x) ||
      !isFiniteNumber(y) ||
      !isFiniteNumber(width) ||
      !isFiniteNumber(height) ||
      width <= 0 ||
      height <= 0
    ) {
      continue;
    }
    const normalizedName = normalizeSavedViewName(name);
    if (!normalizedName) {
      continue;
    }
    ids.add(id);
    savedViews.push({ id, name: normalizedName, x, y, width, height });
  }

  return savedViews;
};
