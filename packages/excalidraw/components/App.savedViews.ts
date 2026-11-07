import { t } from "../i18n";
import {
  addSavedView,
  canAddSavedView,
  canSaveViewport,
  getSavedView,
  getSavedViewViewportOptions,
  removeSavedView,
  renameSavedView,
} from "../savedViews";

import type { SavedView } from "../types";
import type { AnimationOptions } from "../viewport";
import type App from "./App";

/**
 * Host-facing access to the scene's saved views. Changes are applied with
 * `setState`, so — like `updateScene()` — read them back through
 * `onChange()` or `getAppState()` after the next render.
 */
export class AppSavedViews {
  /**
   * The list `save()` calls have produced since `base` was the committed
   * state, while their `setState` is still pending.
   */
  private pendingSaves: {
    base: readonly SavedView[];
    savedViews: readonly SavedView[];
  } | null = null;

  constructor(private app: App) {}

  /** The scene's saved views, in creation order. */
  getAll = (): readonly SavedView[] => this.app.state.savedViews;

  /**
   * Saves the area currently visible in the viewport. Without a (non-blank)
   * name, a "View N" default is used. Returns `null` when the scene already
   * holds the maximum number of saved views, or the editor hasn't been
   * measured yet.
   *
   * The returned view is stored when React commits the update. One case can
   * still drop it: if the scene's saved views were replaced in the same batch
   * before this call (e.g. `updateScene({ appState: { savedViews } })`) with
   * a list already at the limit, the update is skipped and the view is not
   * stored. Check `getAll()` after the next render if that can happen.
   */
  save = (name?: string): SavedView | null => {
    // Saves made since the last commit aren't in `this.app.state` yet, so
    // count and name new views against them too.
    const savedViews =
      this.pendingSaves?.base === this.app.state.savedViews
        ? this.pendingSaves.savedViews
        : this.app.state.savedViews;
    if (!canSaveViewport(this.app.state)) {
      return null;
    }
    const added = addSavedView(
      savedViews,
      this.app.state,
      name,
      t("savedViews.defaultName"),
    );
    if (!added) {
      return null;
    }
    const { savedView } = added;
    this.pendingSaves = {
      base: this.app.state.savedViews,
      savedViews: added.savedViews,
    };
    this.app.setState((prevState) => {
      if (canAddSavedView(prevState.savedViews)) {
        return { savedViews: [...prevState.savedViews, savedView] };
      }
      // the view was never stored, so don't count or name later saves
      // against it
      if (this.pendingSaves?.savedViews.includes(savedView)) {
        this.pendingSaves = null;
      }
      return null;
    });
    return savedView;
  };

  /**
   * Navigates to a saved view. Returns `false` if there's no view with the
   * given id or navigation is disabled.
   */
  goTo = (
    id: string,
    opts?: { animation?: AnimationOptions | boolean },
  ): boolean => {
    const savedView = getSavedView(this.app.state.savedViews, id);
    if (!savedView || !this.app.isNavigationEnabled()) {
      return false;
    }
    this.app.viewport.setViewport(
      getSavedViewViewportOptions(savedView, opts?.animation ?? true),
    );
    return true;
  };

  /**
   * Renames a saved view. Blank names and unknown ids are ignored. Returns
   * nothing; the change is visible through `getAll()` after the next render.
   */
  rename = (id: string, name: string): void => {
    this.app.setState((prevState) => {
      const savedViews = renameSavedView(prevState.savedViews, id, name);
      return savedViews === prevState.savedViews ? null : { savedViews };
    });
  };

  /**
   * Deletes a saved view. Unknown ids are ignored. Returns nothing; the change
   * is visible through `getAll()` after the next render.
   */
  remove = (id: string): void => {
    this.app.setState((prevState) => {
      const savedViews = removeSavedView(prevState.savedViews, id);
      return savedViews === prevState.savedViews ? null : { savedViews };
    });
  };
}
