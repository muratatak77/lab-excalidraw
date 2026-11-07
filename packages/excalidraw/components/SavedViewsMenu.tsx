import { useRef, useState } from "react";

import { KEYS, MAX_SAVED_VIEWS } from "@excalidraw/common";

import {
  actionDeleteSavedView,
  actionGoToSavedView,
  actionRenameSavedView,
  actionSaveView,
} from "../actions/actionSavedViews";
import { useUIAppState } from "../context/ui-appState";
import { t } from "../i18n";

import { useApp, useExcalidrawActionManager } from "./App";
import { FilledButton } from "./FilledButton";
import { TextField } from "./TextField";
import { TrashIcon, pencilIcon, saveViewIcon, savedViewsIcon } from "./icons";

import "./SavedViewsMenu.scss";

import type { SavedView } from "../types";

const SavedViewRenameInput = ({
  name,
  onRename,
  onCancel,
}: {
  name: string;
  onRename: (name: string) => void;
  onCancel: () => void;
}) => {
  // Enter/Escape unmount the input, which may fire a trailing blur — make
  // sure only the first outcome applies
  const settledRef = useRef(false);
  const settle = (callback: () => void) => {
    if (!settledRef.current) {
      settledRef.current = true;
      callback();
    }
  };

  return (
    <div className="saved-views__item saved-views__item--renaming">
      <input
        className="saved-views__rename-input"
        aria-label={t("savedViews.rename")}
        defaultValue={name}
        autoFocus
        onFocus={(event) => event.target.select()}
        onBlur={(event) => {
          const { value } = event.target;
          settle(() => onRename(value));
        }}
        onKeyDown={(event) => {
          // keep editor shortcuts from firing while typing
          event.stopPropagation();
          const { value } = event.currentTarget;
          if (event.key === KEYS.ENTER) {
            settle(() => onRename(value));
          } else if (event.key === KEYS.ESCAPE) {
            settle(onCancel);
          }
        }}
      />
    </div>
  );
};

const SavedViewItem = ({
  savedView,
  editable,
  isRenaming,
  onGoTo,
  onStartRename,
  onRename,
  onCancelRename,
  onDelete,
}: {
  savedView: SavedView;
  editable: boolean;
  isRenaming: boolean;
  onGoTo: () => void;
  onStartRename: () => void;
  onRename: (name: string) => void;
  onCancelRename: () => void;
  onDelete: () => void;
}) => {
  if (isRenaming) {
    return (
      <SavedViewRenameInput
        name={savedView.name}
        onRename={onRename}
        onCancel={onCancelRename}
      />
    );
  }

  return (
    <div className="saved-views__item">
      <button
        type="button"
        className="saved-views__item-name"
        title={savedView.name}
        onClick={onGoTo}
        onDoubleClick={editable ? onStartRename : undefined}
      >
        {savedView.name}
      </button>
      {editable && (
        <div className="saved-views__item-actions">
          <button
            type="button"
            className="saved-views__item-action"
            title={t("savedViews.rename")}
            aria-label={t("savedViews.rename")}
            onClick={onStartRename}
          >
            {pencilIcon}
          </button>
          <button
            type="button"
            className="saved-views__item-action saved-views__item-action--danger"
            title={t("savedViews.delete")}
            aria-label={t("savedViews.delete")}
            onClick={onDelete}
          >
            {TrashIcon}
          </button>
        </div>
      )}
    </div>
  );
};

export const SavedViewsMenu = () => {
  const app = useApp();
  const actionManager = useExcalidrawActionManager();
  const { savedViews, viewModeEnabled } = useUIAppState();
  const [name, setName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);

  const editable = !viewModeEnabled && app.isInteractionEnabled();
  const canNavigate = app.isNavigationEnabled();
  const limitReached = savedViews.length >= MAX_SAVED_VIEWS;

  const saveCurrentView = () => {
    actionManager.executeAction(actionSaveView, "ui", { name });
    setName("");
  };

  return (
    <div className="saved-views">
      {editable && (
        <div className="saved-views__header">
          <TextField
            className="saved-views__name-input"
            placeholder={t("savedViews.namePlaceholder")}
            value={name}
            onChange={setName}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === KEYS.ENTER && !limitReached) {
                saveCurrentView();
              }
            }}
          />
          <FilledButton
            size="medium"
            variant="outlined"
            icon={saveViewIcon}
            label={t("savedViews.saveCurrent")}
            onClick={saveCurrentView}
            disabled={limitReached}
            className="saved-views__save"
          />
        </div>
      )}
      {limitReached && editable && (
        <div className="saved-views__hint">
          {t("savedViews.limitReached", { count: MAX_SAVED_VIEWS })}
        </div>
      )}
      {savedViews.length === 0 ? (
        <div className="saved-views__empty">
          <div className="saved-views__empty-icon">{savedViewsIcon}</div>
          {t("savedViews.empty")}
        </div>
      ) : (
        <div className="saved-views__list" role="list">
          {savedViews.map((savedView) => (
            <SavedViewItem
              key={savedView.id}
              savedView={savedView}
              editable={editable}
              isRenaming={renamingId === savedView.id}
              onGoTo={() => {
                if (canNavigate) {
                  actionManager.executeAction(
                    actionGoToSavedView,
                    "ui",
                    savedView.id,
                  );
                }
              }}
              onStartRename={() => setRenamingId(savedView.id)}
              onRename={(nextName) => {
                setRenamingId(null);
                actionManager.executeAction(actionRenameSavedView, "ui", {
                  id: savedView.id,
                  name: nextName,
                });
              }}
              onCancelRename={() => setRenamingId(null)}
              onDelete={() =>
                actionManager.executeAction(
                  actionDeleteSavedView,
                  "ui",
                  savedView.id,
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};
