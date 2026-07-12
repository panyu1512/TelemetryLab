/**
 * Chrome for a popped-out single-view window (overlay or widget): a slim drag
 * strip that lets the user move the frameless, decoration-less desktop window,
 * plus a close button that also *forgets* the window so it isn't restored on
 * the next launch. Only rendered inside Tauri; a no-op in a plain browser tab.
 */

import { GripHorizontal, X } from "lucide-react";
import { closeCurrentWindow, type WindowKind } from "../lib/overlayWindows";

const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function OverlayChrome({ kind, id }: { kind: WindowKind; id: string }) {
  if (!isTauri) return null;
  return (
    <div
      data-tauri-drag-region
      title="Drag to move this window"
      className="overlay-chrome group relative flex h-5 shrink-0 cursor-grab items-center justify-center opacity-0 transition-opacity hover:opacity-100 active:cursor-grabbing"
    >
      <GripHorizontal data-tauri-drag-region className="size-3.5 text-muted" />
      <button
        type="button"
        onClick={() => closeCurrentWindow(kind, id)}
        title="Close this window"
        className="absolute right-1 grid size-4 place-items-center rounded text-muted transition-colors hover:bg-danger hover:text-white"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}
