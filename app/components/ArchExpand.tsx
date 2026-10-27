"use client";
import { useRef, type ReactNode } from "react";

// "Expand" opens the same diagram larger in a native modal dialog (Esc and the close button dismiss it; the browser returns focus
// to the button). Without JS the button is hidden and the diagram stays in the row (globals.css, html:not(.js) .ar-expand).
export function ArchExpand({ title, children }: { title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className="ar-expand" onClick={() => ref.current?.showModal()}>Expand diagram</button>
      <dialog ref={ref} className="ar-dlg" aria-label={title} onClick={(e) => e.target === ref.current && ref.current.close()}>
        <div className="ar-dlg-bar">
          <span className="label">{title}</span>
          <button type="button" className="ar-close" onClick={() => ref.current?.close()}>Close</button>
        </div>
        <div className="ar-scroll" tabIndex={0} role="region" aria-label={`${title}, scrollable`}>{children}</div>
      </dialog>
    </>
  );
}
