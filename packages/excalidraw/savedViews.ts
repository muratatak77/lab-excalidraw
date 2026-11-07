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
 * Collapses whitespace and clamps the length (counted in code points, so
 * that characters outside the BMP such as emoji are never cut in half).
 * Returns the normalized name, or an empty string for names that contain
 * nothing but whitespace.
 */
export const normalizeSavedViewName = (name: string): string =>
  Array.from(name.replace(/\s+/g, " ").trim())
    .slice(0, SAVED_VIEW_NAME_MAX_LENGTH)
    .join("");

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

/**
 * Returns `true` if another view can be added to `savedViews`, `false` once
 * the list holds {@link MAX_SAVED_VIEWS} views.
 */
export const canAddSavedView = (savedViews: readonly SavedView[]): boolean =>
  savedViews.length < MAX_SAVED_VIEWS;

/**
 * Returns `false` until the editor has been measured (zero-sized viewport),
 * `true` afterwards.
 */
export const canSaveViewport = (appState: ViewportState): boolean =>
  appState.width > 0 && appState.height > 0;

/**
 * Returns a new saved view, with a fresh id, of the scene area currently
 * visible in the viewport.
 */
export const createSavedView = (
  appState: ViewportState,
  name: string,
): SavedView => ({
  id: randomId(),
  name,
  ...getVisibleSceneArea(appState),
});

/**
 * Appends a view of the visible scene area to `savedViews`, named `name` or a
 * "View N" default. Returns the created view and the new list, or `null` if
 * `savedViews` already holds {@link MAX_SAVED_VIEWS} views.
 */
export const addSavedView = (
  savedViews: readonly SavedView[],
  appState: ViewportState,
  name: string | null | undefined,
  defaultPrefix: string,
): { savedView: SavedView; savedViews: readonly SavedView[] } | null => {
  if (!canAddSavedView(savedViews)) {
    return null;
  }
  const savedView = createSavedView(
    appState,
    resolveSavedViewName(savedViews, name, defaultPrefix),
  );
  return { savedView, savedViews: [...savedViews, savedView] };
};

/** Returns the saved view with the given id, or `null` if there is none. */
export const getSavedView = (
  savedViews: readonly SavedView[],
  id: string,
): SavedView | null => savedViews.find((view) => view.id === id) ?? null;

/**
 * Returns the `setViewport()` options that show `savedView`'s area. Uses
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

/**
 * Returns `savedViews` with the view `id` renamed. Returns the same list
 * (by identity) if the name is blank, unchanged, or no view has that id.
 */
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

/**
 * Returns `savedViews` without the view `id`, or the same list (by identity)
 * if no view has that id.
 */
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
