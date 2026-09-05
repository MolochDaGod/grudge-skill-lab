import { useCallback, useEffect, useRef, useState } from "react";
import { SkillStudio } from "@/components/skill-studio";

type LabApp = {
  load: () => Promise<void>;
  dispose: () => void;
  editor: { toggle: () => void };
};

export function AbilityLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<LabApp | null>(null);
  const [entered, setEntered] = useState(false);
  const [studio, setStudio] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  const boot = useCallback(async () => {
    const canvas = canvasRef.current;
    const hud = hudRef.current;
    const loader = loaderRef.current;
    if (!canvas || !hud || !loader) return;
    try {
      const { App } = await import("@/lab/core/App.js");
      const app = new App(canvas, { hud, loader }) as LabApp;
      appRef.current = app;
      (window as unknown as { app: LabApp }).app = app;
      await app.load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start the lab";
      setBootError(message);
      console.error("[lab] boot failed", error);
    }
  }, []);

  useEffect(() => {
    if (!entered) return;
    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      await boot();
    })();
    return () => {
      cancelled = true;
      appRef.current?.dispose();
      appRef.current = null;
    };
  }, [entered, boot]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
      if (event.code === "KeyU") {
        event.preventDefault();
        setStudio((open) => !open);
      }
    };
    const onStudio = () => setStudio((open) => !open);
    window.addEventListener("keydown", onKey);
    window.addEventListener("lab:toggleStudio", onStudio);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("lab:toggleStudio", onStudio);
    };
  }, []);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-bg text-fg">
      <canvas id="viewport" ref={canvasRef} />

      <div id="loader" className={entered ? "loader" : "loader is-hidden"} ref={loaderRef}>
        <div className="loader__inner">
          <img className="brand-helm" src="/brand/helmet.png" alt="" />
          <img className="brand-wordmark" src="/brand/logo.png" alt="Grudge" />
          <p className="loader__title">Ability Lab</p>
          <div className="loader__bar">
            <i id="loader-fill" data-loader-fill />
          </div>
          <p className="loader__status" id="loader-status" data-loader-status>
            {bootError ?? "Compiling the crowns…"}
          </p>
        </div>
      </div>

      <div id="hud" className="hud" aria-live="polite" ref={hudRef} />

      {entered ? (
        <>
          <div className="lab-tools">
            <button
              type="button"
              className="studio-toggle"
              onClick={() => window.dispatchEvent(new Event("lab:toggleLibrary"))}
            >
              Library
            </button>
            <button type="button" className="studio-toggle" onClick={() => setStudio((v) => !v)}>
              Studio
            </button>
            <button
              type="button"
              className="studio-toggle"
              onClick={() =>
                (window as unknown as { app?: { scriptPanel?: { toggle: () => void } } }).app?.scriptPanel?.toggle()
              }
            >
              Scripts
            </button>
            <button
              type="button"
              className="brand-settings"
              title="Settings (G)"
              onClick={() => window.dispatchEvent(new Event("lab:toggleEditor"))}
            >
              <img src="/brand/settings.png" alt="Settings" />
            </button>
          </div>
          <SkillStudio open={studio} onClose={() => setStudio(false)} />
        </>
      ) : (
        <div className="lab-gate">
          <div className="lab-gate__card">
            <img className="brand-helm" src="/brand/helmet.png" alt="" />
            <img className="brand-wordmark" src="/brand/logo.png" alt="Grudge" />
            <p className="lab-gate__kicker">Ability Lab</p>
            <p className="lab-gate__lead">
              Crusade, Fabled, Legion. Six race kits, eight Warlord classes.
              1-2-3 is that weapon's own combo — not a shared 2H take. Pack is right-click to wear.
            </p>
            <div className="lab-gate__keys">
              <div>
                <b>1–3</b> weapon combo
              </div>
              <div>
                <b>I</b> races · Warlord classes
              </div>
              <div>
                <b>RMB</b> wear from the pack
              </div>
              <div>
                <b>L</b> clip · effect · editor library
              </div>
              <div>
                <b>G U</b> VFX editor · studio
              </div>
            </div>
            <button type="button" className="lab-gate__enter" onClick={() => setEntered(true)}>
              Enter the lab
            </button>
            <p className="lab-gate__hint">Aim with the mouse. Left click to cast. Right drag to orbit.</p>
          </div>
        </div>
      )}
    </main>
  );
}
