// @ts-nocheck
/**
 * Client-only grove engine entry. Loaded as a real <script type="module"> so a
 * failed live-reload cannot pin Chrome's dynamic-import cache.
 */
import { App } from './core/App.js';

if (typeof window !== 'undefined') {
  window.GrudgeLabApp = App;
}

export { App };
