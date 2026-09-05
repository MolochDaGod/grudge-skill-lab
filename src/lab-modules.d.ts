declare module "@/lab/core/App.js" {
  export class App {
    constructor(
      canvas: HTMLCanvasElement,
      options?: { hud?: HTMLElement | null; loader?: HTMLElement | null },
    );
    load(): Promise<void>;
    dispose(): void;
    editor: {
      toggle: () => void;
      refresh: () => void;
      presets: {
        persistSession: () => boolean;
        ingest: (data: unknown) => { applied: boolean; kind?: string; imported?: string[] };
      };
    };
    scripts?: { compile: () => { message: string }[] };
    scriptPanel?: { toggle: () => void };
    hud?: { showToast: (message: string) => void; setAura?: (form: string, meta: { id?: string; label?: string; accent?: string }) => void };
    auras?: { cycle: (form: string) => string; pulse: (role: string) => boolean; snapshot: () => unknown };
    tryDash?: () => boolean;
    element?: string;
  }
}

declare module "@/lab/config/settings.js" {
  export const settings: Record<string, any>;
  export const ELEMENTS: string[];
  export const ELEMENT_META: Record<
    string,
    { label: string; accent: string; key: string; hint: string; cast?: string }
  >;
  export const CastShape: Record<string, string>;
}

declare module "@/lab/config/skillCatalog.js" {
  export const SKILL_CATALOG: Array<{
    id: string;
    catalogId: string;
    family: string;
    delivery: string;
    weaponTypeId: string;
    animRole: string;
    statuses: unknown[];
  }>;
  export const DELIVERY_GROUPS: Record<string, string[]>;
  export function exportSkillPrefab(id: string): unknown;
  export function exportAllSkills(): unknown;
  export function importLabPayload(data: unknown): boolean;
  export function applySkillPrefab(prefab: unknown): boolean;
}

declare module "@/lab/scripts/scriptDocument.js" {
  export function listScripts(key?: string): Array<{
    id: string;
    key: string;
    name: string;
    source: string;
    enabled: boolean;
  }>;
}
