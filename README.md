# Act JS: Project Context for Development

## Overview

Act JS is a lightweight reactive UI library built from scratch as a hobby project. It's designed to be a minimal, SEO-friendly alternative to React, intended for use with Django backends. The library is ~570 lines of JavaScript with zero dependencies.

**Goal**: Build a simple, understandable reactive UI library that can eventually support server-side rendering with Django.

---

## Project Structure

```
act JS/
├── index.html                          # Entry point — loads app.js as ES module
├── app.js                              # Main app — imports components, mounts the app
├── act.js                       # Core library (570 lines)
├── styles.css                          # All styles (317 lines)
MIME types
└── components/
    ├── timer.js                        # Stopwatch — LOCAL SCOPE example
    ├── counter.js                      # Increment/decrement — GLOBAL STATE example
    ├── phone-form.js                   # Contact form — GLOBAL STATE example
    └── todos/                          # Molecular component structure
        ├── todo.js                     # Parent — creates scope, composes molecules
        ├── input.js                    # Molecule — text input + add button
        ├── filter.js                   # Molecule — all/active/done filters
        └── list.js                     # Molecule — render, toggle, delete items
```

---

## Core Library API (Act.js)

### Creating an App

```js
import { createApp } from "./act.js";
const app = createApp(document.getElementById("root"));
```

`createApp(container)` returns an app object with the full API. The container is the DOM element where the app renders.

### Global State

Shared across ALL components. Any component can read/write.

```js
app.setState(key, value)    // Set a global state value. Triggers re-render.
app.getState(key)           // Read a global state value.
app.deleteState(key)        // Remove a global state key.
```

**Example (Counter component uses global state):**
```js
app.setState("count", 0);
app.on("increment", () => {
  app.setState("count", app.getState("count") + 1);
});
```

**Risk**: Key collisions. If two components both use `app.setState("count", ...)`, they overwrite each other. Convention is to manually prefix keys (e.g., `phone_input`, `phone_name`).

### Local Scope

Private state isolated to a component. Event handlers are auto-namespaced.

```js
app.createScope(name)       // Create a new scope. Returns scope object.
app.getScope(name)          // Get an existing scope by name. Returns scope or null.
```

**Scope object API:**
```js
scope.setState(key, value)  // Set local state. Triggers re-render.
scope.getState(key)         // Read local state.
scope.deleteState(key)      // Remove a local state key.
scope.getGlobal(key)        // Read global state (read-only access).
scope.on(name, fn)          // Register handler as "scopeName:handlerName".
scope.off(name)             // Unregister a handler.
scope.handler(name)         // Get namespaced handler name for templates (e.g., "timer:start").
scope.all()                 // Get snapshot of all local state as plain object.
scope.destroy()             // Remove all handlers and state for this scope.
```

**Example (Timer component uses local scope):**
```js
const scope = app.createScope("timer");
scope.setState("seconds", 0);
scope.on("start", () => { ... });
// In template: data-on='{"click":"${scope.handler("start")}"}'
// Registers as "timer:start" internally
```

**Cross-scope access**: Any component can read another component's scope:
```js
const timerSeconds = app.getScope("timer").getState("seconds");
const todoItems = app.getScope("todo").getState("items");
```

**Important**: Scopes must be created before they're accessed. Component initialization order in app.js determines availability.

### Event Handlers

**Global handlers** (used with global state):
```js
app.on(name, fn)            // Register a global handler.
app.off(name)               // Unregister a global handler.
```

**Scoped handlers** (used with local scope):
```js
scope.on(name, fn)          // Registered as "scopeName:name".
scope.handler(name)         // Returns "scopeName:name" for use in templates.
```

**In templates**, handlers are bound via `data-on` attributes (JSON format):
```html
<button data-on='{"click":"handlerName"}'>Click</button>
<input data-on='{"input":"onInput","keydown":"onKeydown"}' />
```

For scoped handlers, use `scope.handler()`:
```html
<button data-on='{"click":"${scope.handler("start")}"}'>Start</button>
<!-- Renders as: data-on='{"click":"timer:start"}' -->
```

### Template Engine

Uses tagged template literals to create DOM fragments:

```js
app.html`<div class="card"><h2>${title}</h2></div>`
// Returns a DocumentFragment
```

- Handles string interpolation and arrays (for lists).
- Arrays are joined automatically: `${items.map(i => `<li>${i}</li>`)}`.
- Returns a `DocumentFragment` parsed via the browser's `<template>` element.

### Mounting

```js
app.mount((globalState) => app.html`
  <div class="app">
    <h1>${globalState.appName}</h1>
    ${renderTimer()}
    ${renderCounter(globalState)}
  </div>
`);
```

- The render function receives `globalState` as its argument.
- Components using local scope don't need `globalState` — they read from their scope internally.
- Components using global state receive `globalState` as an argument to their render function.

### Safe Timers

Tracked wrappers around native `setInterval`/`setTimeout` to prevent memory leaks:

```js
app.safeSetInterval(fn, ms)     // Returns interval ID. Tracked for cleanup.
app.safeClearInterval(id)       // Clear and untrack.
app.safeSetTimeout(fn, ms)      // Returns timeout ID. Auto-untracked on fire.
app.safeClearTimeout(id)        // Clear and untrack.
```

### Cleanup / Destroy

```js
app.destroy()   // Full cleanup: listeners, timers, scopes, state, DOM.
```

Called automatically on `beforeunload` in app.js. Also destroys all scopes.

### Focus Preservation

On re-render, the library saves and restores focus + cursor position for inputs with a `data-id` attribute:

```html
<input data-id="todo-input" ... />
```

Without `data-id`, inputs lose focus on every re-render because the entire DOM is replaced.

---

## Component Architecture

### Component Pattern

Every component is a function that:
1. Receives the `app` instance.
2. Sets up state (global or scoped).
3. Registers event handlers.
4. Returns a render function.

```js
export function MyComponent(app) {
  // 1. Setup state
  const scope = app.createScope("myComponent");
  scope.setState("value", "");

  // 2. Register handlers
  scope.on("change", (e) => {
    scope.setState("value", e.target.value);
  });

  // 3. Return render function
  return () => {
    const value = scope.getState("value");
    return `<input value="${value}" data-on='{"input":"${scope.handler("change")}"}' />`;
  };
}
```

### Two State Approaches (by example)

**LOCAL SCOPE** (Timer, Todo) — components own their state:
```js
// timer.js
const scope = app.createScope("timer");
scope.setState("seconds", 0);
scope.on("start", fn);

// Render reads from scope, not globalState
return () => {
  const seconds = scope.getState("seconds");
  return `<p>${seconds}</p>`;
};
```

**GLOBAL STATE** (Counter, Phone Form) — state is shared:
```js
// counter.js
app.setState("count", 0);
app.on("increment", fn);

// Render receives globalState
return (globalState) => {
  return `<p>${globalState.count}</p>`;
};
```

### Molecular Component Pattern (Todo example)

Complex components are split into small, focused molecules:

```
TodoComponent (parent)
├── TodoInput (molecule)    — owns input text, writes to parent's items
├── TodoFilter (molecule)   — owns filter state, reads parent's items
└── TodoList (molecule)     — reads parent's items + sibling's filter
```

Molecules communicate via `app.getScope()`:
```js
// Inside TodoList — reading parent and sibling scopes
const items = app.getScope("todo").getState("items");
const filter = app.getScope("todoFilter").getState("current");
```

---

## Rendering Cycle

```
setState() called
    ↓
rerender() triggered (if mounted)
    ↓
Save focus (activeElement + cursor position via data-id)
    ↓
cleanupListeners() — remove all tracked event listeners
    ↓
renderFn(globalState) — generate new DOM fragment
    ↓
container.innerHTML = "" → appendChild(new content)
    ↓
bindEvents() — find data-on attributes, attach handlers, track them
    ↓
Restore focus + cursor position
```

**Key limitation**: Full DOM replacement on every state change. No virtual DOM diffing. This means:
- Every `setState` call replaces the entire DOM tree.
- Inputs need `data-id` for focus preservation.
- Multiple rapid `setState` calls cause multiple re-renders (no batching).

---

## Memory Safety Features

1. **Event listener tracking**: Every listener added in `bindEvents()` is stored in `activeListeners[]`. Before each re-render, `cleanupListeners()` removes them all.

2. **Safe timers**: `safeSetInterval`/`safeSetTimeout` track IDs in Sets. `app.destroy()` clears them all.

3. **Scope cleanup**: Each scope has a `destroy()` method that removes its handlers and state. `app.destroy()` calls this on all scopes.

4. **Handler warnings**: If a `data-on` attribute references a handler that doesn't exist, a console warning is logged.

---

## Known Limitations & Areas for Improvement

### Current Limitations
1. **No virtual DOM diffing** — full DOM replacement on every state change. Causes performance issues with large component trees and requires `data-id` hack for input focus.
2. **No batched updates** — each `setState()` triggers a separate re-render. Rapid successive calls (e.g., resetting multiple fields) cause multiple re-renders.
3. **No component lifecycle hooks** — no `onMount`, `onDestroy`, `onUpdate` callbacks.
4. **No conditional rendering helper** — ternaries in template strings work but get messy.
5. **No server-side rendering** — the `html` tagged template returns DOM fragments, not HTML strings. Django integration would need an HTML string renderer.
6. **No routing** — single-page only.
7. **No TypeScript types**.
8. **XSS vulnerability** — template interpolation doesn't escape HTML. User input injected into templates could execute scripts.

### Potential Next Steps
- **Virtual DOM diffing** — only update changed nodes instead of replacing everything. This would eliminate the `data-id` focus hack and greatly improve performance.
- **Batched re-renders** — queue `setState` calls and flush once per microtask using `queueMicrotask()` or `requestAnimationFrame()`.
- **Lifecycle hooks** — `onMount(fn)`, `onDestroy(fn)`, `onUpdate(fn)` per scope.
- **HTML string rendering** — `app.renderToString()` for server-side rendering with Django.
- **Auto-escaping** — escape interpolated values to prevent XSS.
- **Routing** — client-side router with `history.pushState`.
- **DevTools** — debug panel showing all scopes, their state, and handler registry.
- **TypeScript support** — type definitions for the API.

---

## Development Setup

### Using Python (with correct MIME types)
```bash
cd Act JS
python3 server.py
# Opens at http://localhost:8000
```

### Using Node.js
```bash
cd Act JS
npx serve
```

### Using CodeSandbox
- Upload all files maintaining the folder structure.
- Make sure `index.html` loads `app.js` as `<script type="module" src="app.js"></script>`.
- ES modules require `type="module"` on the script tag.

---

## Quick Reference: Full API

```js
// ── App Creation ──
const app = createApp(document.getElementById("root"));

// ── Global State ──
app.setState(key, value)
app.getState(key)
app.deleteState(key)

// ── Local Scope ──
const scope = app.createScope("name")
app.getScope("name")

// ── Scope API ──
scope.setState(key, value)
scope.getState(key)
scope.deleteState(key)
scope.getGlobal(key)
scope.on(handlerName, fn)
scope.off(handlerName)
scope.handler(handlerName)    // → "scopeName:handlerName"
scope.all()
scope.destroy()

// ── Global Events ──
app.on(name, fn)
app.off(name)

// ── Lifecycle ──
app.mount(renderFn)
app.destroy()

// ── Template ──
app.html`<div>${value}</div>`

// ── Safe Timers ──
app.safeSetInterval(fn, ms)
app.safeClearInterval(id)
app.safeSetTimeout(fn, ms)
app.safeClearTimeout(id)
```

---

## Existing Scopes Registry

These scopes are currently in use across the app:

| Scope Name    | Component       | State Keys                | Purpose                    |
|---------------|-----------------|---------------------------|----------------------------|
| `timer`       | timer.js        | seconds, running          | Stopwatch state            |
| `todo`        | todos/todo.js   | items, nextId             | Shared todo data           |
| `todoInput`   | todos/input.js  | text                      | Input field value          |
| `todoFilter`  | todos/filter.js | current                   | Active filter selection    |
| `todoList`    | todos/list.js   | (none, handlers only)     | Toggle/delete handlers     |

## Global State Keys

These keys are in the shared globalState:

| Key              | Component       | Type    | Purpose                    |
|------------------|-----------------|---------|----------------------------|
| `appName`        | app.js          | string  | App title                  |
| `theme`          | app.js          | string  | Theme setting              |
| `count`          | counter.js      | number  | Counter value              |
| `phone_input`    | phone-form.js   | string  | Phone number field         |
| `phone_name`     | phone-form.js   | string  | Name field                 |
| `phone_submitted`| phone-form.js   | boolean | Submission success flag    |
| `phone_contacts` | phone-form.js   | array   | Saved contacts list        |
| `phone_error`    | phone-form.js   | string  | Validation error message   |