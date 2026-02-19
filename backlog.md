# Act JS — Backlog

---

## Performance

- [ ] **Virtual DOM diffing** — only update changed nodes instead of replacing the entire DOM tree. Eliminates the `data-id` focus hack and greatly improves performance on large component trees.
- [ ] **Batched re-renders** — queue `setState` calls and flush once per microtask using `queueMicrotask()` or `requestAnimationFrame()`. Currently each `setState` triggers a full re-render immediately.
- [ ] **Critical CSS inlining** — extract and inline above-the-fold CSS directly into `<head>` at build/render time, defer the rest. Key for perceived load performance and Core Web Vitals (FCP, LCP).

---

## Package / Module System

- [ ] **Import map support** — define bare specifier mappings in `index.html` via `<script type="importmap">` so components can do `import { x } from "some-lib"` without a bundler.
- [ ] **CDN integration** — conventions and helpers for pulling packages from esm.sh / jsDelivr / unpkg as ES modules, keeping the zero-bundler setup intact.
- [ ] **Bundler integration (opt-in)** — document how to wire Act JS into Vite or esbuild for projects that do want npm packages, tree-shaking, and a build step, without changing the core library.
- [ ] **Dependency isolation per scope** — pattern/docs for scoping a third-party lib instance (e.g., a date picker, chart lib) to a single component scope so it gets cleaned up on `scope.destroy()`.

---

## Developer Experience

- [ ] **Lifecycle hooks** — `onMount(fn)`, `onDestroy(fn)`, `onUpdate(fn)` callbacks per scope.
- [ ] **TypeScript support** — type definitions (`.d.ts`) for the full API.
- [ ] **DevTools panel** — debug overlay showing all active scopes, their state snapshots, and the full handler registry.
- [ ] **Conditional rendering helper** — cleaner alternative to inline ternaries in template strings.

---

## Security

- [ ] **Auto-escaping** — escape interpolated values in `app.html` tagged templates to prevent XSS. Currently user input injected into templates can execute scripts.

---

## SEO

- [ ] **`renderToString()` / SSR** — HTML string renderer (instead of `DocumentFragment`) for server-side rendering with Django. This is the core requirement for SEO-friendly output.
- [ ] **Meta tag manager** — API to set `<title>`, `<meta name="description">`, Open Graph, and Twitter Card tags per page/component, updated on route change.
- [ ] **Canonical URL support** — set `<link rel="canonical">` declaratively from component/route config.
- [ ] **Structured data helpers** — utility to inject JSON-LD blocks (`<script type="application/ld+json">`) for rich results.
- [ ] **Semantic HTML conventions** — document and enforce usage of correct landmark elements (`<main>`, `<article>`, `<nav>`, etc.) in component templates.
- [ ] **`lang` attribute management** — ensure `<html lang="...">` is set and update it on locale changes.

---

## Routing

- [ ] **Client-side router** — `history.pushState`-based router with route definitions, params, and query string parsing.
- [ ] **Route-level code splitting** — load component JS only when the route is first visited.
- [ ] **404 / fallback route** — default catch-all handler.

---

## SSR / Django Integration

- [ ] **HTML string renderer** — `app.renderToString(renderFn, initialState)` returns a plain HTML string (not a DOM fragment) for Django template injection.
- [ ] **Hydration** — after Django serves the initial HTML, the client-side library attaches event handlers without re-rendering the DOM (`app.hydrate(container)`).
- [ ] **Initial state injection** — Django serialises initial state into a `<script>` tag; `createApp` picks it up to avoid a redundant first render.
