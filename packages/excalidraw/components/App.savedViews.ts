import { t } from "../i18n";
import {
  canAddSavedView,
  canSaveViewport,
  createSavedView,
  getSavedView,
  getSavedViewViewportOptions,
  removeSavedView,
  renameSavedView,
  resolveSavedViewName,
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
   */
  save = (name?: string): SavedView | null => {
    // Saves made since the last commit aren't in `this.app.state` yet, so
    // count and name new views against them too.
    const savedViews =
      this.pendingSaves?.base === this.app.state.savedViews
        ? this.pendingSaves.savedViews
        : this.app.state.savedViews;
    if (!canAddSavedView(savedViews) || !canSaveViewport(this.app.state)) {
      return null;
    }
    const savedView = createSavedView(
      this.app.state,
      resolveSavedViewName(savedViews, name, t("savedViews.defaultName")),
    );
    this.pendingSaves = {
      base: this.app.state.savedViews,
      savedViews: [...savedViews, savedView],
    };
    this.app.setState((prevState) =>
      canAddSavedView(prevState.savedViews)
        ? { savedViews: [...prevState.savedViews, savedView] }
        : null,
    );
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

  /** Renames a saved view. Blank names are ignored. */
  rename = (id: string, name: string) => {
    this.app.setState((prevState) => {
      const savedViews = renameSavedView(prevState.savedViews, id, name);
      return savedViews === prevState.savedViews ? null : { savedViews };
    });
  };

  remove = (id: string) => {
    this.app.setState((prevState) => {
      const savedViews = removeSavedView(prevState.savedViews, id);
      return savedViews === prevState.savedViews ? null : { savedViews };
    });
  };
}
