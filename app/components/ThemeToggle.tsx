"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Icon } from "./Icon";

const dark = () => window.matchMedia("(prefers-color-scheme: dark)");

function current() {
  const t = document.documentElement.dataset.theme;
  return t === "light" || t === "dark" ? t : dark().matches ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  const mq = dark();
  mq.addEventListener("change", onChange);
  window.addEventListener("themechange", onChange);
  return () => {
    mq.removeEventListener("change", onChange);
    window.removeEventListener("themechange", onChange);
  };
}

// The browser bar follows the ground. The boot script does this before hydration; this covers the metas Next adds after it.
function syncBar() {
  const ground = getComputedStyle(document.documentElement).getPropertyValue("--ground").trim();
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => { m.content = ground; });
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, current, () => null);
  useEffect(syncBar, [theme]);
  const label = theme === null ? "Switch theme" : theme === "dark" ? "Switch to light theme" : "Switch to dark theme";

  function toggle() {
    const next = current() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {}
    window.dispatchEvent(new Event("themechange"));
  }

  return (
    <button className="theme" type="button" aria-label={label} onClick={toggle}>
      <Icon name="sun" size={20} />
      <Icon name="moon" size={20} />
    </button>
  );
}
