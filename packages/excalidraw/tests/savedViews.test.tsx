import React from "react";
import { vi } from "vitest";

import {
  DEFAULT_SIDEBAR,
  KEYS,
  MAX_SAVED_VIEWS,
  SAVED_VIEWS_SIDEBAR_TAB,
} from "@excalidraw/common";

import { Excalidraw } from "../index";
import {
  actionDeleteSavedView,
  actionGoToSavedView,
  actionRenameSavedView,
  actionSaveView,
  actionToggleSavedViews,
} from "../actions";

import { addSavedView, normalizeSavedViewName } from "../savedViews";

import { API } from "./helpers/api";
import { act, fireEvent, render, waitFor } from "./test-utils";

import type { NormalizedZoomValue, SavedView } from "../types";

const { h } = window;

const makeView = (id: string, name = id): SavedView => ({
  id,
  name,
  x: 0,
  y: 0,
  width: 100,
  height: 100,
});

const getContainer = () => h.app.excalidrawContainerValue.container!;

const openSavedViewsTab = async () => {
  API.executeAction(actionToggleSavedViews);
  await waitFor(() =>
    expect(getContainer().querySelector(".saved-views")).not.toBeNull(),
  );
};

const queryItemNames = () =>
  Array.from(
    getContainer().querySelectorAll<HTMLButtonElement>(
      ".saved-views__item-name",
    ),
  ).map((button) => button.textContent);

describe("saved views", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally />);
    // jsdom doesn't lay out the editor, so give it a measured viewport
    API.setAppState({
      openSidebar: null,
      savedViews: [],
      width: 1000,
      height: 800,
    });
  });

  describe("actions", () => {
    it("saves the visible scene area with a default name", () => {
      API.setAppState({
        scrollX: -100,
        scrollY: -200,
        zoom: { value: 2 as NormalizedZoomValue },
      });

      API.executeAction(actionSaveView);

      expect(h.state.savedViews).toEqual([
        {
          id: expect.any(String),
          name: "View 1",
          x: 100,
          y: 200,
          width: 500,
          height: 400,
        },
      ]);
      expect(h.state.toast?.message).toBe(`Saved "View 1"`);
    });

    it("uses the given name and skips taken default names", () => {
      API.setAppState({ savedViews: [makeView("a", "View 2")] });

      act(() => {
        h.app.actionManager.executeAction(actionSaveView, "api", {
          name: "  Overview   of\tdiagram ",
        });
      });
      API.executeAction(actionSaveView);

      expect(h.state.savedViews.map((view) => view.name)).toEqual([
        "View 2",
        "Overview of diagram",
        "View 3",
      ]);
    });

    it("refuses to save past the limit", () => {
      const savedViews = Array.from({ length: MAX_SAVED_VIEWS }, (_, i) =>
        makeView(`view-${i}`),
      );
      API.setAppState({ savedViews });

      API.executeAction(actionSaveView);

      expect(h.state.savedViews).toBe(savedViews);
      expect(h.state.toast?.message).toBe(
        `You can save up to ${MAX_SAVED_VIEWS} views per scene.`,
      );
    });

    it("renames and deletes views", () => {
      API.setAppState({ savedViews: [makeView("a"), makeView("b")] });

      act(() => {
        h.app.actionManager.executeAction(actionRenameSavedView, "api", {
          id: "a",
          name: "Header",
        });
      });
      expect(h.state.savedViews.map((view) => view.name)).toEqual([
        "Header",
        "b",
      ]);

      // blank names are ignored
      act(() => {
        h.app.actionManager.executeAction(actionRenameSavedView, "api", {
          id: "a",
          name: "   ",
        });
      });
      expect(h.state.savedViews[0].name).toBe("Header");

      act(() => {
        h.app.actionManager.executeAction(actionDeleteSavedView, "api", "a");
      });
      expect(h.state.savedViews.map((view) => view.id)).toEqual(["b"]);
    });

    it("navigates to a saved view, fitting its area", () => {
      const savedView = makeView("a");
      API.setAppState({ savedViews: [savedView] });
      const setViewport = vi.spyOn(h.app.viewport, "setViewport");

      act(() => {
        h.app.actionManager.executeAction(actionGoToSavedView, "api", "a");
        h.app.actionManager.executeAction(
          actionGoToSavedView,
          "api",
          "missing",
        );
      });

      expect(setViewport).toHaveBeenCalledTimes(1);
      expect(setViewport).toHaveBeenCalledWith({
        target: { x: 0, y: 0, width: 100, height: 100 },
        fit: "contain",
        animation: true,
      });
      setViewport.mockRestore();
    });

    it("toggles the saved views sidebar tab", () => {
      API.executeAction(actionToggleSavedViews);
      expect(h.state.openSidebar).toEqual({
        name: DEFAULT_SIDEBAR.name,
        tab: SAVED_VIEWS_SIDEBAR_TAB,
      });

      API.executeAction(actionToggleSavedViews);
      expect(h.state.openSidebar).toBeNull();
    });
  });

  describe("imperative API", () => {
    it("saves a view and restores the viewport it captured", async () => {
      API.setAppState({
        scrollX: -300,
        scrollY: -150,
        zoom: { value: 2 as NormalizedZoomValue },
      });

      let savedView: SavedView | null = null;
      act(() => {
        savedView = h.app.api.savedViews.save("Detail");
      });
      expect(savedView).not.toBeNull();
      expect(h.app.api.savedViews.getAll()).toEqual([savedView]);

      API.setAppState({
        scrollX: 0,
        scrollY: 0,
        zoom: { value: 1 as NormalizedZoomValue },
      });

      let navigated = false;
      act(() => {
        navigated = h.app.api.savedViews.goTo(savedView!.id, {
          animation: false,
        });
      });

      expect(navigated).toBe(true);
      expect(h.state.zoom.value).toBeCloseTo(2);
      expect(h.state.scrollX).toBeCloseTo(-300);
      expect(h.state.scrollY).toBeCloseTo(-150);
    });

    it("returns false for unknown views and edits by id", () => {
      API.setAppState({ savedViews: [makeView("a"), makeView("b")] });

      expect(h.app.api.savedViews.goTo("missing")).toBe(false);

      act(() => {
        h.app.api.savedViews.rename("b", "Renamed");
        h.app.api.savedViews.remove("a");
      });

      expect(h.app.api.savedViews.getAll()).toEqual([
        { ...makeView("b"), name: "Renamed" },
      ]);
    });

    it("doesn't save before the editor has been measured", () => {
      API.setAppState({ width: 0, height: 0 });
      expect(h.app.api.savedViews.save()).toBeNull();
      API.executeAction(actionSaveView);
      expect(h.state.savedViews).toEqual([]);
    });

    it("counts and names views saved in the same batch", () => {
      API.setAppState({
        savedViews: Array.from({ length: MAX_SAVED_VIEWS - 2 }, (_, i) =>
          makeView(`view-${i}`),
        ),
      });
      let saved: (SavedView | null)[] = [];
      act(() => {
        saved = [
          h.app.api.savedViews.save(),
          h.app.api.savedViews.save(),
          h.app.api.savedViews.save(),
        ];
      });
      expect(saved[0]?.name).toBe(`View ${MAX_SAVED_VIEWS - 1}`);
      expect(saved[1]?.name).toBe(`View ${MAX_SAVED_VIEWS}`);
      expect(saved[2]).toBeNull();
      expect(h.state.savedViews).toHaveLength(MAX_SAVED_VIEWS);
      expect(h.state.savedViews.slice(-2)).toEqual([saved[0], saved[1]]);
    });

    it("doesn't keep a view whose update was rejected at the limit", () => {
      const full = Array.from({ length: MAX_SAVED_VIEWS }, (_, i) =>
        makeView(`view-${i}`),
      );
      let saved: SavedView | null = null;
      act(() => {
        h.app.api.updateScene({ appState: { savedViews: full } });
        saved = h.app.api.savedViews.save();
      });
      // documented case: save() can't see the pending updateScene()
      expect(saved).not.toBeNull();
      expect(h.state.savedViews).toBe(full);
      expect(h.app.api.savedViews.save()).toBeNull();
      expect(h.state.savedViews).toBe(full);
    });

    it("returns null when the limit is reached", () => {
      API.setAppState({
        savedViews: Array.from({ length: MAX_SAVED_VIEWS }, (_, i) =>
          makeView(`view-${i}`),
        ),
      });
      expect(h.app.api.savedViews.save()).toBeNull();
      expect(h.state.savedViews).toHaveLength(MAX_SAVED_VIEWS);
    });
  });

  describe("helpers", () => {
    it("clamps names without splitting surrogate pairs", () => {
      const name = `${"a".repeat(79)}😀😀`;
      const normalized = normalizeSavedViewName(name);
      expect(normalized).toBe(`${"a".repeat(79)}😀`);
    });

    it("adds a view unless the list is full", () => {
      const viewport = {
        scrollX: -10,
        scrollY: -20,
        zoom: { value: 2 as NormalizedZoomValue },
        width: 1000,
        height: 800,
      };
      const added = addSavedView([makeView("a")], viewport, null, "View");
      expect(added?.savedView).toMatchObject({
        name: "View 2",
        x: 10,
        y: 20,
        width: 500,
        height: 400,
      });
      expect(added?.savedViews).toEqual([makeView("a"), added?.savedView]);
      const full = Array.from({ length: MAX_SAVED_VIEWS }, (_, i) =>
        makeView(`view-${i}`),
      );
      expect(addSavedView(full, viewport, "x", "View")).toBeNull();
    });
  });

  describe("sidebar tab", () => {
    it("shows an empty state and saves the named current view", async () => {
      await openSavedViewsTab();

      expect(getContainer().querySelector(".saved-views__empty")).not.toBe(
        null,
      );

      const input = getContainer().querySelector<HTMLInputElement>(
        ".saved-views__name-input input",
      )!;
      fireEvent.change(input, { target: { value: "Legend" } });
      fireEvent.keyDown(input, { key: KEYS.ENTER });

      await waitFor(() => expect(queryItemNames()).toEqual(["Legend"]));
      expect(input.value).toBe("");
    });

    it("navigates, renames and deletes from the list", async () => {
      API.setAppState({ savedViews: [makeView("a", "First")] });
      await openSavedViewsTab();
      const setViewport = vi.spyOn(h.app.viewport, "setViewport");

      fireEvent.click(getContainer().querySelector(".saved-views__item-name")!);
      expect(setViewport).toHaveBeenCalledTimes(1);
      setViewport.mockRestore();

      fireEvent.click(getContainer().querySelector('[aria-label="Rename"]')!);
      const renameInput = getContainer().querySelector<HTMLInputElement>(
        ".saved-views__rename-input",
      )!;
      fireEvent.change(renameInput, { target: { value: "Intro" } });
      fireEvent.keyDown(renameInput, { key: KEYS.ENTER });

      await waitFor(() => expect(queryItemNames()).toEqual(["Intro"]));
      expect(h.state.savedViews[0].name).toBe("Intro");

      fireEvent.click(getContainer().querySelector('[aria-label="Delete"]')!);
      await waitFor(() => expect(h.state.savedViews).toEqual([]));
    });

    it("cancels renaming on Escape", async () => {
      API.setAppState({ savedViews: [makeView("a", "First")] });
      await openSavedViewsTab();

      fireEvent.click(getContainer().querySelector('[aria-label="Rename"]')!);
      const renameInput = getContainer().querySelector<HTMLInputElement>(
        ".saved-views__rename-input",
      )!;
      fireEvent.change(renameInput, { target: { value: "Ignored" } });
      fireEvent.keyDown(renameInput, { key: KEYS.ESCAPE });
      fireEvent.blur(renameInput);

      await waitFor(() => expect(queryItemNames()).toEqual(["First"]));
      expect(h.state.savedViews[0].name).toBe("First");
    });

    it("is read-only in view mode", async () => {
      API.setAppState({
        viewModeEnabled: true,
        savedViews: [makeView("a", "First")],
      });
      await openSavedViewsTab();

      expect(queryItemNames()).toEqual(["First"]);
      expect(
        getContainer().querySelector(".saved-views__name-input"),
      ).toBeNull();
      expect(getContainer().querySelector('[aria-label="Rename"]')).toBeNull();
      expect(getContainer().querySelector('[aria-label="Delete"]')).toBeNull();
    });
  });
});
