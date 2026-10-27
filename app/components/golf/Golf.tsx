"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/app/components/Icon";
import { holePoints, holeViewBox } from "./hole-fallback";
import type { Action, Hud, Shell, Sink } from "./shell";

const REPO = "https://github.com/karthikm062025S/portfolio/tree/main/golf";
const INITIAL: Hud = { hole: 1, holes: 9, par: 3, strokes: 0, wind: 0, spin: "low", note: "", over: null };

type State = "idle" | "loading" | "ready" | "failed";

// The hole as a still picture: complete content before (and without) any script.
function Fallback() {
  const [, , w, h] = holeViewBox.split(" ").map(Number);
  return (
    <svg className="golf-fallback" viewBox={`-2 ${-h * 2} ${w + 4} ${h * 3 + 1}`} preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">
      <polygon points={`${holePoints} ${w},${h + 1} 0,${h + 1}`} fill="var(--hair)" />
      <polyline points={holePoints} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Golf() {
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const shell = useRef<Shell | null>(null);
  const share = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [state, setState] = useState<State>("idle");
  const [hud, setHud] = useState<Hud>(INITIAL);
  const [polite, setPolite] = useState("");
  const [assertive, setAssertive] = useState("");
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState("");

  useEffect(() => {
    const el = root.current;
    const cv = canvas.current;
    const st = stage.current;
    if (!el || !cv || !st) return;
    let dead = false;
    const sink: Sink = {
      set: (patch) => setHud((h) => ({ ...h, ...patch })),
      polite: setPolite,
      assertive: setAssertive,
      ready: () => setState("ready"),
    };
    const replay = new URLSearchParams(location.search).get("r");
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      setState("loading");
      import("./shell")
        .then((m) => m.mount({ canvas: cv, stage: st, sink, replay }))
        .then((s) => { if (dead) s.destroy(); else shell.current = s; })
        .catch(() => { if (!dead) setState("failed"); });
    }, { rootMargin: "400px" });
    io.observe(el);
    return () => {
      dead = true;
      io.disconnect();
      shell.current?.destroy();
      shell.current = null;
      window.clearTimeout(timer.current);
    };
  }, []);

  function act(a: Action) { if (a === "next") setManual(""); shell.current?.act(a); }

  function done() {
    setCopied(true);
    setPolite("Result copied");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { setCopied(false); setPolite(""); }, 2000);
  }

  // No clipboard access: show the text and select it so it can be copied by hand.
  function select(text: string) {
    setManual(text);
    window.setTimeout(() => {
      const target = share.current;
      const selection = window.getSelection();
      if (!target || !selection) return;
      const range = document.createRange();
      range.selectNodeContents(target);
      selection.removeAllRanges();
      selection.addRange(range);
    }, 0);
  }

  function copy() {
    const text = shell.current?.share();
    if (!text) return;
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => select(text));
    else select(text);
  }

  const wind = Math.round(hud.wind);
  const over = hud.over;

  return (
    <div className="golf" ref={root} data-state={state}>
      <div className="golf-stage" ref={stage}>
        <Fallback />
        <canvas
          ref={canvas}
          className="golf-canvas"
          role="application"
          aria-label="Golf: drag or use the arrow keys to aim, Space to hit"
          tabIndex={0}
        />
        {hud.note && !over && <p className="golf-note label">{hud.note}</p>}
        {over && (
          <div className="golf-over">
            <p className="golf-over-t">{over.title}</p>
            <p className="golf-over-d label">{over.detail}</p>
            <div className="golf-over-b">
              <button type="button" className="golf-btn" onClick={copy}>{copied ? "Copied" : "Copy result"}</button>
              {!over.final && <button type="button" className="golf-btn pri" onClick={() => act("next")}>Next hole</button>}
            </div>
            {manual && <span ref={share} className="golf-share label">{manual}</span>}
          </div>
        )}
      </div>
      <div className="golf-bar">
        <p className="golf-hud label">
          <span>Hole <b>{hud.hole}</b> of {hud.holes}</span>
          <span>Par <b>{hud.par}</b></span>
          <span>Strokes <b>{hud.strokes}</b></span>
          <span>
            Wind {wind === 0 ? "calm" : <><span aria-hidden="true">{wind > 0 ? "→" : "←"}</span><span className="sr">{wind > 0 ? "toward the cup" : "away from the cup"}</span> <b>{Math.abs(wind)}</b> m/s</>}
          </span>
        </p>
        <a className="golf-src" href={REPO} target="_blank" rel="noopener" aria-label="Source on GitHub (opens in a new tab)">Source<Icon name="arrow-up-right" /></a>
      </div>
      <details
        className="golf-ctl"
        onFocus={(e) => {
          const d = e.currentTarget;
          if (e.target instanceof HTMLElement && e.target.matches("summary:focus-visible")) d.open = true;
        }}
      >
        <summary><span className="label">Controls</span><span className="pm" aria-hidden="true"><Icon name="plus" /></span></summary>
        <div className="golf-keys">
          <button type="button" className="golf-btn" onClick={() => act("aim+")}>Aim up</button>
          <button type="button" className="golf-btn" onClick={() => act("aim-")}>Aim down</button>
          <button type="button" className="golf-btn" onClick={() => act("power-")}>Less power</button>
          <button type="button" className="golf-btn" onClick={() => act("power+")}>More power</button>
          <button type="button" className="golf-btn" onClick={() => act("spin")}>Spin: {hud.spin}</button>
          <button type="button" className="golf-btn" onClick={() => act("restart")}>Restart hole</button>
          <button type="button" className="golf-btn pri" onClick={() => act("hit")}>Hit</button>
        </div>
      </details>
      <p className="sr" aria-live="polite">{polite}</p>
      <p className="sr" aria-live="assertive">{assertive}</p>
    </div>
  );
}
