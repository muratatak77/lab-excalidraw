import {
  DEFAULT_SIDEBAR,
  MAX_SAVED_VIEWS,
  SAVED_VIEWS_SIDEBAR_TAB,
} from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element";

import { savedViewsIcon, saveViewIcon } from "../components/icons";
import { t } from "../i18n";
import {
  addSavedView,
  canSaveViewport,
  getSavedView,
  getSavedViewViewportOptions,
  removeSavedView,
  renameSavedView,
} from "../savedViews";

import { register } from "./register";

export const actionSaveView = register<{ name?: string } | undefined>({
  name: "saveView",
  label: "savedViews.saveCurrent",
  icon: saveViewIcon,
  keywords: ["bookmark", "viewport", "camera", "save"],
  trackEvent: { category: "canvas" },
  perform: (_elements, appState, data) => {
    if (!canSaveViewport(appState)) {
      return false;
    }
    const added = addSavedView(
      appState.savedViews,
      appState,
      data?.name,
      t("savedViews.defaultName"),
    );
    if (!added) {
      return {
        appState: {
          ...appState,
          toast: {
            message: t("savedViews.limitReached", { count: MAX_SAVED_VIEWS }),
            closable: true,
          },
        },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }

    return {
      appState: {
        ...appState,
        savedViews: added.savedViews,
        toast: {
          message: t("savedViews.saved", { name: added.savedView.name }),
        },
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
});

export const actionGoToSavedView = register<string>({
  name: "goToSavedView",
  label: "savedViews.title",
  icon: savedViewsIcon,
  viewMode: true,
  navigation: true,
  trackEvent: { category: "canvas" },
  predicate: (_elements, _appState, _props, app) => app.isNavigationEnabled(),
  perform: (_elements, appState, id, app) => {
    const savedView = id ? getSavedView(appState.savedViews, id) : null;
    if (!savedView) {
      return false;
    }

    app.viewport.setViewport(getSavedViewViewportOptions(savedView));

    // the viewport updates on its own (animated), nothing to apply here
    return false;
  },
});

export const actionRenameSavedView = register<{ id: string; name: string }>({
  name: "renameSavedView",
  label: "savedViews.rename",
  trackEvent: { category: "canvas" },
  perform: (_elements, appState, data) => {
    if (!data) {
      return false;
    }
    const savedViews = renameSavedView(appState.savedViews, data.id, data.name);
    if (savedViews === appState.savedViews) {
      return false;
    }
    return {
      appState: { ...appState, savedViews },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
});

export const actionDeleteSavedView = register<string>({
  name: "deleteSavedView",
  label: "savedViews.delete",
  trackEvent: { category: "canvas" },
  perform: (_elements, appState, id) => {
    if (!id) {
      return false;
    }
    const savedViews = removeSavedView(appState.savedViews, id);
    if (savedViews === appState.savedViews) {
      return false;
    }
    return {
      appState: { ...appState, savedViews },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
});

export const actionToggleSavedViews = register({
  name: "toggleSavedViews",
  label: "savedViews.title",
  icon: savedViewsIcon,
  keywords: ["bookmark", "viewport", "camera"],
  viewMode: true,
  trackEvent: { category: "menu" },
  perform: (_elements, appState) => {
    const isOpen =
      appState.openSidebar?.name === DEFAULT_SIDEBAR.name &&
      appState.openSidebar.tab === SAVED_VIEWS_SIDEBAR_TAB;

    return {
      appState: {
        ...appState,
        openSidebar: isOpen
          ? null
          : { name: DEFAULT_SIDEBAR.name, tab: SAVED_VIEWS_SIDEBAR_TAB },
        openDialog: null,
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState) =>
    appState.openSidebar?.name === DEFAULT_SIDEBAR.name &&
    appState.openSidebar.tab === SAVED_VIEWS_SIDEBAR_TAB,
});
