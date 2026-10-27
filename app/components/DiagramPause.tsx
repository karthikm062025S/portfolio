"use client";
import { useEffect } from "react";

// Marks each diagram that has left the viewport so its packet pauses (globals.css ".dg[data-off]").
export function DiagramPause() {
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.target.toggleAttribute("data-off", !e.isIntersecting)));
    document.querySelectorAll(".dg").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return null;
}
