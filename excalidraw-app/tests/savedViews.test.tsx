import { Excalidraw } from "@excalidraw/excalidraw";
import {
  clearAppStateForLocalStorage,
  getDefaultAppState,
} from "@excalidraw/excalidraw/appState";
import { restoreAppState } from "@excalidraw/excalidraw/data/restore";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@excalidraw/excalidraw/tests/test-utils";

import { DEFAULT_SIDEBAR, SAVED_VIEWS_SIDEBAR_TAB } from "@excalidraw/common";

import type { SavedView } from "@excalidraw/excalidraw/types";

import { STORAGE_KEYS } from "../app_constants";
import { Provider } from "../app-jotai";
import { AppMainMenu } from "../components/AppMainMenu";
import { importFromLocalStorage } from "../data/localStorage";

const { h } = window;

const savedView: SavedView = {
  id: "view-1",
  name: "Architecture overview",
  x: 120,
  y: -40,
  width: 960,
  height: 540,
};

describe("saved views in excalidraw-app", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("persists saved views in browser storage", () => {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_APP_STATE,
      JSON.stringify(
        clearAppStateForLocalStorage({
          ...getDefaultAppState(),
          savedViews: [savedView],
        }),
      ),
    );

    const { appState } = importFromLocalStorage();

    expect(appState?.savedViews).toEqual([savedView]);
    expect(restoreAppState(appState, null).savedViews).toEqual([savedView]);
  });

  it("doesn't carry local views over into a scene loaded from a share link", () => {
    // what `initializeScene()` does for `#json=` links: the imported scene
    // is restored on top of the local appState
    const localAppState = {
      ...getDefaultAppState(),
      savedViews: [savedView],
    };
    const importedAppState = { viewBackgroundColor: "#a5d8ff" };

    expect(restoreAppState(importedAppState, localAppState).savedViews).toEqual(
      [],
    );
  });

  it("opens the saved views sidebar from the main menu", async () => {
    await render(
      <Provider>
        <Excalidraw>
          <AppMainMenu
            onCollabDialogOpen={() => {}}
            isCollaborating={false}
            isCollabEnabled={false}
            theme="light"
            refresh={() => {}}
          />
        </Excalidraw>
      </Provider>,
    );

    fireEvent.click(screen.getByTestId("main-menu-trigger"));
    fireEvent.click(screen.getByTestId("saved-views-menu-button"));

    await waitFor(() =>
      expect(h.state.openSidebar).toEqual({
        name: DEFAULT_SIDEBAR.name,
        tab: SAVED_VIEWS_SIDEBAR_TAB,
      }),
    );
    expect(document.querySelector(".saved-views__empty")).not.toBeNull();
  });
});
