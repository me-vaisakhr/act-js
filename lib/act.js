/**
 * act.js
 * A lightweight reactive UI library with global and scoped state management.
 *
 * STATE MANAGEMENT:
 * -----------------
 * 1. Global State (app.setState / app.getState):
 *    - Shared across ALL components.
 *    - Any component can read/write global state.
 *    - Use for: theme, user info, shared data between unrelated components.
 *
 * 2. Local Scope (app.createScope / app.getScope):
 *    - Private state isolated to a component or group of components.
 *    - Other components can access it via app.getScope("name") if they know the name.
 *    - Event handlers are auto-namespaced to prevent collisions.
 *    - Use for: component-specific data that doesn't need to be global.
 *
 * EXAMPLE:
 * --------
 *   // Global — any component sees this
 *   app.setState("user", "Vaisakh");
 *
 *   // Local — only this component's scope
 *   const scope = app.createScope("timer");
 *   scope.setState("seconds", 0);
 *
 *   // Another component can read timer's state if needed
 *   const timerScope = app.getScope("timer");
 *   timerScope.getState("seconds"); // → 0
 *
 * RENDERING:
 * ----------
 * Uses tagged template literals (app.html`...`) to create DOM nodes.
 * Event handlers are bound via data-on attributes in templates.
 * Full DOM replacement on every state change (no virtual DOM diffing).
 *
 * MEMORY SAFETY:
 * --------------
 * - Event listeners are tracked and cleaned up before each re-render.
 * - Intervals/timeouts are tracked via safeSetInterval/safeSetTimeout.
 * - app.destroy() cleans up everything (listeners, timers, scopes, state, DOM).
 */
function createApp(container) {
  /**
   * Global state object.
   * Accessible by all components via app.setState() and app.getState().
   */
  let globalState = {};

  /**
   * Registry of all local scopes.
   * Each scope has its own private state, handlers, and cleanup.
   * Key: scope name (string), Value: scope object.
   */
  const scopes = {};

  /** The render function provided by app.mount(). Receives globalState. */
  let renderFn = null;

  /** Flag to prevent re-renders before mount() is called. */
  let mounted = false;

  /** Tracks active event listeners for cleanup on re-render. */
  let activeListeners = [];

  /** Tracks active setInterval IDs for cleanup on destroy. */
  const intervals = new Set();

  /** Tracks active setTimeout IDs for cleanup on destroy. */
  const timeouts = new Set();

  /** Batches multiple setState calls into a single re-render per microtask. */
  let rerenderScheduled = false;

  /** CSS strings registered via criticalCSS() — converted to sheets at mount time. */
  const criticalCSSStrings = [];

  /** CSSStyleSheet objects registered via criticalStylesheet(). */
  const criticalSheets = [];

  /** Sheets created from criticalCSSStrings at mount time — tracked for destroy() cleanup. */
  let mountedStringSheets = [];

  function scheduleRerender() {
    if (!rerenderScheduled) {
      rerenderScheduled = true;
      queueMicrotask(() => {
        rerenderScheduled = false;
        rerender();
      });
    }
  }

  // =========================================================================
  // CRITICAL CSS
  // =========================================================================

  /**
   * Register a CSS string as critical. Applied via document.adoptedStyleSheets at mount().
   * Use this when your CSS lives in a .css.js file or a template literal.
   *
   * @param {string} css - CSS string to apply at mount time.
   *
   * @example
   *   import layoutCSS from "./app.css.js";
   *   app.criticalCSS(layoutCSS);
   */
  function criticalCSS(css) {
    criticalCSSStrings.push(css.trim());
  }

  /**
   * Register a CSSStyleSheet as critical. Applied via document.adoptedStyleSheets at mount().
   * Use this with native CSS Module Script imports (`import sheet from "./x.css" with { type: "css" }`).
   *
   * @param {CSSStyleSheet} sheet - CSSStyleSheet object to apply at mount time.
   *
   * @example
   *   import timerSheet from "./timer.css" with { type: "css" };
   *   app.criticalStylesheet(timerSheet);
   */
  function criticalStylesheet(sheet) {
    if (sheet) criticalSheets.push(sheet); // null guard: no-op in built output
  }

  // =========================================================================
  // GLOBAL STATE
  // =========================================================================

  /**
   * Set a global state value. Triggers re-render if app is mounted.
   * @param {string} key - State key.
   * @param {*} value - State value.
   *
   * @example
   *   app.setState("theme", "dark");
   *   app.setState("user", { name: "Vaisakh", role: "admin" });
   */
  function setState(key, value) {
    globalState[key] = value;
    if (mounted) scheduleRerender();
  }

  /**
   * Get a global state value.
   * @param {string} key - State key.
   * @returns {*} The stored value, or undefined if not set.
   *
   * @example
   *   const theme = app.getState("theme"); // → "dark"
   */
  function getState(key) {
    return globalState[key];
  }

  /**
   * Delete a global state key.
   * @param {string} key - State key to remove.
   */
  function deleteState(key) {
    delete globalState[key];
  }

  // =========================================================================
  // LOCAL SCOPE
  // =========================================================================

  /**
   * Create a new local scope for a component.
   * Each scope has its own private state and namespaced event handlers.
   * If a scope with the same name already exists, returns the existing one.
   *
   * @param {string} name - Unique scope name (e.g., "timer", "todoInput").
   * @returns {Object} Scope object with setState, getState, on, handler, etc.
   *
   * @example
   *   const scope = app.createScope("timer");
   *   scope.setState("seconds", 0);
   *   scope.on("start", () => { ... });
   *
   *   // In template:
   *   `<button data-on='{"click":"${scope.handler("start")}"}'>Start</button>`
   */
  function createScope(name) {
    if (scopes[name]) {
      console.warn(
        `[act.js] Scope "${name}" already exists. Use app.getScope("${name}") to access it.`
      );
      return scopes[name];
    }

    /** Private state for this scope — not accessible outside without getScope(). */
    const localState = {};

    const scope = {
      /** The scope's name, used for handler namespacing. */
      name,

      /**
       * Set a local state value. Triggers re-render if app is mounted.
       * @param {string} key - State key (local to this scope).
       * @param {*} value - State value.
       *
       * @example
       *   scope.setState("count", 0);
       */
      setState(key, value) {
        localState[key] = value;
        if (mounted) scheduleRerender();
      },

      /**
       * Get a local state value.
       * @param {string} key - State key.
       * @returns {*} The stored value.
       *
       * @example
       *   scope.getState("count"); // → 0
       */
      getState(key) {
        return localState[key];
      },

      /**
       * Delete a local state key.
       * @param {string} key - State key to remove.
       */
      deleteState(key) {
        delete localState[key];
      },

      /**
       * Read a global state value from within a scope.
       * This is read-only access to the global state.
       * @param {string} key - Global state key.
       * @returns {*} The global value.
       *
       * @example
       *   const theme = scope.getGlobal("theme"); // → "dark"
       */
      getGlobal(key) {
        return globalState[key];
      },

      /**
       * Register a scoped event handler.
       * The handler is auto-namespaced as "scopeName:handlerName".
       * @param {string} handlerName - Handler name (without prefix).
       * @param {Function} fn - Event handler function.
       *
       * @example
       *   scope.on("click", (e) => { ... });
       *   // Registered internally as "timer:click"
       */
      on(handlerName, fn) {
        handlers[`${name}:${handlerName}`] = fn;
      },

      /**
       * Unregister a scoped event handler.
       * @param {string} handlerName - Handler name to remove.
       */
      off(handlerName) {
        delete handlers[`${name}:${handlerName}`];
      },

      /**
       * Get the full namespaced handler name for use in templates.
       * @param {string} handlerName - Handler name.
       * @returns {string} Namespaced handler name.
       *
       * @example
       *   scope.handler("click"); // → "timer:click"
       *
       *   // Used in templates:
       *   `<button data-on='{"click":"${scope.handler("click")}"}'>Click</button>`
       */
      handler(handlerName) {
        return `${name}:${handlerName}`;
      },

      /**
       * Get a snapshot of all local state as a plain object.
       * @returns {Object} Copy of the local state.
       */
      all() {
        return { ...localState };
      },

      /**
       * Destroy this scope — removes all handlers and clears local state.
       * Called automatically by app.destroy(), or manually if needed.
       */
      destroy() {
        for (const key of Object.keys(handlers)) {
          if (key.startsWith(`${name}:`)) {
            delete handlers[key];
          }
        }
        for (const key of Object.keys(localState)) {
          delete localState[key];
        }
        delete scopes[name];
      },
    };

    scopes[name] = scope;
    return scope;
  }

  /**
   * Get an existing scope by name.
   * Use this to access another component's scope for reading/writing its state.
   *
   * @param {string} name - Scope name.
   * @returns {Object|null} The scope object, or null if not found.
   *
   * @example
   *   // From inside TodoList, read TodoFilter's state:
   *   const filter = app.getScope("todoFilter").getState("current");
   */
  function getScope(name) {
    const scope = scopes[name];
    if (!scope) {
      console.warn(
        `[act.js] Scope "${name}" not found. Make sure it's created first.`
      );
      return null;
    }
    return scope;
  }

  // =========================================================================
  // SAFE TIMERS (tracked for cleanup)
  // =========================================================================

  /**
   * Wrapper around setInterval that tracks the ID for cleanup.
   * Use this instead of raw setInterval to prevent memory leaks.
   *
   * @param {Function} fn - Callback function.
   * @param {number} ms - Interval in milliseconds.
   * @returns {number} Interval ID.
   *
   * @example
   *   const id = app.safeSetInterval(() => {
   *     scope.setState("seconds", scope.getState("seconds") + 1);
   *   }, 1000);
   */
  function safeSetInterval(fn, ms) {
    const id = setInterval(fn, ms);
    intervals.add(id);
    return id;
  }

  /**
   * Clear a tracked interval.
   * @param {number} id - Interval ID returned by safeSetInterval.
   */
  function safeClearInterval(id) {
    clearInterval(id);
    intervals.delete(id);
  }

  /**
   * Wrapper around setTimeout that tracks the ID for cleanup.
   * Auto-removes from tracking when the timeout fires.
   *
   * @param {Function} fn - Callback function.
   * @param {number} ms - Delay in milliseconds.
   * @returns {number} Timeout ID.
   */
  function safeSetTimeout(fn, ms) {
    const id = setTimeout(() => {
      timeouts.delete(id);
      fn();
    }, ms);
    timeouts.add(id);
    return id;
  }

  /**
   * Clear a tracked timeout.
   * @param {number} id - Timeout ID returned by safeSetTimeout.
   */
  function safeClearTimeout(id) {
    clearTimeout(id);
    timeouts.delete(id);
  }

  // =========================================================================
  // RENDERING
  // =========================================================================

  /**
   * Remove all tracked event listeners from the DOM.
   * Called before every re-render to prevent memory leaks.
   */
  function cleanupListeners() {
    for (const { el, event, handler } of activeListeners) {
      el.removeEventListener(event, handler);
    }
    activeListeners = [];
  }

  /**
   * Re-render the entire app.
   * 1. Saves current focus and cursor position.
   * 2. Cleans up old event listeners.
   * 3. Calls renderFn(globalState) to generate new DOM.
   * 4. Replaces container contents.
   * 5. Binds new event listeners.
   * 6. Restores focus and cursor position.
   */
  function rerender() {
    if (!renderFn) return;

    // Save focus state for restoration after DOM replacement
    const activeEl = document.activeElement;
    const activeId = activeEl?.getAttribute("data-id");
    const cursorPos = activeEl?.selectionStart;

    // Cleanup and rebuild
    cleanupListeners();
    const content = renderFn(globalState);
    container.innerHTML = "";
    container.appendChild(content);
    bindEvents(container);

    // Restore focus on the element with matching data-id
    if (activeId) {
      const el = container.querySelector(`[data-id="${activeId}"]`);
      if (el) {
        el.focus();
        if (cursorPos !== undefined && el.setSelectionRange) {
          el.setSelectionRange(cursorPos, cursorPos);
        }
      }
    }
  }

  /**
   * Find all elements with data-on attributes and bind their event handlers.
   * data-on format: '{"eventName":"handlerName"}' (JSON object).
   *
   * @param {HTMLElement} root - Root element to search within.
   *
   * @example
   *   // In template:
   *   <button data-on='{"click":"counter:increment"}'>+</button>
   *
   *   // This will call handlers["counter:increment"] on click.
   */
  function bindEvents(root) {
    root.querySelectorAll("[data-on]").forEach((el) => {
      const eventMap = JSON.parse(el.getAttribute("data-on"));
      for (const [event, handlerName] of Object.entries(eventMap)) {
        const handler = handlers[handlerName];
        if (handler) {
          el.addEventListener(event, handler);
          activeListeners.push({ el, event, handler });
        } else {
          console.warn(
            `[act.js] No handler registered for "${handlerName}"`
          );
        }
      }
      el.removeAttribute("data-on");
    });
  }

  /** Registry of all event handlers (both global and scoped). */
  const handlers = {};

  /**
   * Register a global event handler (not scoped).
   * @param {string} name - Handler name.
   * @param {Function} fn - Event handler function.
   *
   * @example
   *   app.on("globalClick", () => console.log("clicked"));
   */
  function on(name, fn) {
    handlers[name] = fn;
  }

  /**
   * Unregister a global event handler.
   * @param {string} name - Handler name to remove.
   */
  function off(name) {
    delete handlers[name];
  }

  // =========================================================================
  // LIFECYCLE
  // =========================================================================

  /**
   * Mount the app with a render function.
   * The render function receives globalState and should return a DocumentFragment
   * (created via app.html`...`).
   *
   * @param {Function} fn - Render function: (globalState) => DocumentFragment.
   *
   * @example
   *   app.mount((state) => app.html`
   *     <div class="app">
   *       <h1>${state.appName}</h1>
   *       ${renderTimer()}
   *       ${renderCounter()}
   *     </div>
   *   `);
   */
  function mount(fn) {
    // Convert registered CSS strings into CSSStyleSheet objects
    mountedStringSheets = criticalCSSStrings.map((css) => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      return sheet;
    });

    // Apply all critical sheets atomically before first render
    if (mountedStringSheets.length > 0 || criticalSheets.length > 0) {
      document.adoptedStyleSheets = [
        ...document.adoptedStyleSheets,
        ...mountedStringSheets,
        ...criticalSheets,
      ];
    }

    renderFn = fn;
    mounted = true;
    rerender();
  }

  /**
   * Destroy the app — full cleanup.
   * - Removes all event listeners.
   * - Clears all tracked intervals and timeouts.
   * - Destroys all scopes (their state and handlers).
   * - Clears the container DOM.
   * - Resets global state and handlers.
   *
   * Call this when navigating away or removing the app.
   *
   * @example
   *   window.addEventListener("beforeunload", () => app.destroy());
   */
  function destroy() {
    mounted = false;
    renderFn = null;

    cleanupListeners();

    for (const id of intervals) clearInterval(id);
    intervals.clear();

    for (const id of timeouts) clearTimeout(id);
    timeouts.clear();

    for (const name of Object.keys(scopes)) {
      scopes[name].destroy();
    }

    // Remove only the adopted stylesheets this app registered
    const allRegistered = [...mountedStringSheets, ...criticalSheets];
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
      (s) => !allRegistered.includes(s)
    );
    criticalCSSStrings.length = 0;
    criticalSheets.length = 0;
    mountedStringSheets = [];

    container.innerHTML = "";
    globalState = {};
    for (const key of Object.keys(handlers)) {
      delete handlers[key];
    }

    console.log("[act.js] App destroyed and cleaned up.");
  }

  // =========================================================================
  // TEMPLATE ENGINE
  // =========================================================================

  /**
   * Tagged template literal for creating DOM nodes from HTML strings.
   * Handles string interpolation, arrays (for lists), and nested templates.
   *
   * @param {TemplateStringsArray} strings - Static template parts.
   * @param {...*} values - Dynamic values to interpolate.
   * @returns {DocumentFragment} Parsed DOM fragment.
   *
   * @example
   *   const fragment = app.html`
   *     <div class="card">
   *       <h2>${title}</h2>
   *       <ul>${items.map(item => `<li>${item}</li>`)}</ul>
   *     </div>
   *   `;
   */
  function html(strings, ...values) {
    let raw = strings.reduce((result, str, i) => {
      let value = values[i] ?? "";
      if (Array.isArray(value)) value = value.join("");
      return result + str + value;
    }, "");

    const template = document.createElement("template");
    template.innerHTML = raw.trim();
    return template.content;
  }

  // =========================================================================
  // PUBLIC API
  // =========================================================================

  return {
    // Global state
    setState,
    getState,
    deleteState,

    // Local scope
    createScope,
    getScope,

    // Global events
    on,
    off,

    // Lifecycle
    mount,
    destroy,

    // Template
    html,

    // Safe timers
    safeSetInterval,
    safeClearInterval,
    safeSetTimeout,
    safeClearTimeout,

    // Critical CSS
    criticalCSS,
    criticalStylesheet,
  };
}

export { createApp };
