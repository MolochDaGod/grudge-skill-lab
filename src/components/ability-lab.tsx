import { useCallback, useEffect, useRef, useState } from "react";
import { SkillStudio } from "@/components/skill-studio";

type LabApp = {
  load: () => Promise<void>;
  dispose: () => void;
  editor: { toggle: () => void };
};

type AppCtor = new (canvas: HTMLCanvasElement, options?: object) => LabApp;

function engineSrc() {
  try {
    return new URL("../lab/boot-export.js", import.meta.url).href;
  } catch {
    return "/src/lab/boot-export.js";
  }
}

/**
 * Load the grove constructor without `import()`. Chrome caches a failed
 * dynamic import for the life of the tab; a cache-busted module script does not.
 */
function loadAppCtor(): Promise<AppCtor> {
  const existing = (window as unknown as { GrudgeLabApp?: AppCtor }).GrudgeLabApp;
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.type = "module";
    const src = engineSrc();
    script.src = `${src}${src.includes("?") ? "&" : "?"}t=${Date.now()}`;
    script.onload = () => {
      const ctor = (window as unknown as { GrudgeLabApp?: AppCtor }).GrudgeLabApp;
      if (!ctor) reject(new Error("Grove engine loaded without App"));
      else resolve(ctor);
    };
    script.onerror = () => reject(new Error("Grove engine failed to load"));
    document.head.appendChild(script);
  });
}

export function AbilityLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<LabApp | null>(null);
  const [studio, setStudio] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  const boot = useCallback(async () => {
    const canvas = canvasRef.current;
    const hud = hudRef.current;
    const loader = loaderRef.current;
    if (!canvas || !hud || !loader) return;
    try {
      setBootError(null);
      const held = (window as unknown as { __grudgeApp?: LabApp }).__grudgeApp;
      if (held) {
        appRef.current = held;
        loader.classList.add("is-hidden");
        return;
      }
      const App = await loadAppCtor();
      const app = new App(canvas, { hud, loader }) as LabApp;
      appRef.current = app;
      const bag = window as unknown as { app: LabApp; __grudgeApp: LabApp };
      bag.app = app;
      bag.__grudgeApp = app;
      await app.load();
    } catch (error) {
      const raw = error instanceof Error ? error.message : "Failed to start the lab";
      setBootError(raw);
      console.error("[lab] boot failed", error);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      await boot();
    })();
    return () => {
      cancelled = true;
      if (import.meta.hot) return;
      appRef.current?.dispose();
      appRef.current = null;
      delete (window as unknown as { __grudgeApp?: LabApp }).__grudgeApp;
    };
  }, [boot]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT"))
        return;
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

      <div id="loader" className="loader" ref={loaderRef}>
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
              <button type="button" className="lab-gate__enter" onClick={() => window.location.reload()}>
                Reload grove
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div id="hud" className="hud" aria-live="polite" ref={hudRef} />

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
    </main>
  );
}
