import { useCallback, useEffect, useRef, useState } from "react";
import { SkillStudio } from "@/components/skill-studio";

type LabApp = {
  load: () => Promise<void>;
  dispose: () => void;
  editor: { toggle: () => void };
};

type LabModule = { App: new (canvas: HTMLCanvasElement, options?: object) => LabApp };

/**
 * Chrome caches a *failed* dynamic import forever for that URL. After a live
 * reload drops App.js mid-fetch, `import("@/lab/core/App.js")` keeps throwing
 * "Failed to fetch dynamically imported module" until we change the URL or
 * reload the page.
 */
async function importLabModule(): Promise<LabModule> {
  try {
    return (await import("@/lab/core/App.js")) as LabModule;
  } catch (error) {
    if (!import.meta.env.DEV) throw error;
    await new Promise((resolve) => setTimeout(resolve, 350));
    return (await import(/* @vite-ignore */ `/src/lab/core/App.js?t=${Date.now()}`)) as LabModule;
  }
}

let labModule: Promise<LabModule> | null = null;

function labEngine(): Promise<LabModule> {
  labModule ??= importLabModule().catch((error) => {
    labModule = null;
    throw error;
  });
  return labModule;
}

export function AbilityLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<LabApp | null>(null);
  const [entered, setEntered] = useState(false);
  const [studio, setStudio] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    void labEngine().catch(() => {
      /* preload only — boot() surfaces the error */
    });
  }, []);

  const boot = useCallback(async () => {
    const canvas = canvasRef.current;
    const hud = hudRef.current;
    const loader = loaderRef.current;
    if (!canvas || !hud || !loader) return;
    try {
      setBootError(null);
      const { App } = await labEngine();
      const existing = (window as unknown as { __grudgeApp?: LabApp }).__grudgeApp;
      if (existing) {
        appRef.current = existing;
        loader.classList.add("is-hidden");
        return;
      }
      const app = new App(canvas, { hud, loader }) as LabApp;
      appRef.current = app;
      (window as unknown as { app: LabApp; __grudgeApp: LabApp }).app = app;
      (window as unknown as { __grudgeApp: LabApp }).__grudgeApp = app;
      await app.load();
    } catch (error) {
      const raw = error instanceof Error ? error.message : "Failed to start the lab";
      const dropped = /failed to fetch dynamically imported module/i.test(raw);
      const message = dropped
        ? "The grove engine dropped during a live reload. Hit Retry."
        : raw;
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
      // Keep the WebGL grove across React refresh. Disposing here is what
      // leaves the canvas dead and the next import() stuck on a failed module.
      if (import.meta.hot) return;
      appRef.current?.dispose();
      appRef.current = null;
      delete (window as unknown as { __grudgeApp?: LabApp }).__grudgeApp;
    };
  }, [entered, boot, retryTick]);

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

  const retry = () => {
    labModule = null;
    delete (window as unknown as { __grudgeApp?: LabApp }).__grudgeApp;
    try {
      appRef.current?.dispose();
    } catch {
      /* already torn down */
    }
    appRef.current = null;
    setBootError(null);
    setRetryTick((n) => n + 1);
  };

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
          {bootError ? (
            <div className="loader__retry">
              <button type="button" className="lab-gate__enter" onClick={retry}>
                Retry
              </button>
              <button type="button" className="studio-toggle" onClick={() => window.location.reload()}>
                Reload
              </button>
            </div>
          ) : null}
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
              1–3 is that weapon's own combo — not a shared 2H take. Pack is right-click to wear.
            </p>
            <div className="lab-gate__keys">
              <div>
                <b>WASD</b> walk the grove
              </div>
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
            <p className="lab-gate__hint">WASD to walk. Aim with the mouse. Left click to cast. Right drag to orbit.</p>
          </div>
        </div>
      )}
    </main>
  );
}
