"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/app/components/Icon";

export function CopyEmail({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function done() {
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2000);
  }

  // No clipboard access: select the visible address so it can be copied by hand.
  function select() {
    const link = button.current?.closest("ul")?.querySelector("a");
    const selection = window.getSelection();
    if (!link || !selection) return;
    const range = document.createRange();
    range.selectNodeContents(link);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function copy() {
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(email).then(done, select);
    else select();
  }

  return (
    <>
      <button ref={button} className={copied ? "copy ok" : "copy"} type="button" onClick={copy}>
        <Icon name="copy" />
        <Icon name="check" />
        <span className="t">{copied ? "Copied" : "Copy email"}</span>
      </button>
      <span className="sr" aria-live="polite">{copied ? "Copied" : ""}</span>
    </>
  );
}
