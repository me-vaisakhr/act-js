/**
 * CounterComponent
 * ────────────────
 * STATE: GLOBAL (app.setState / app.getState)
 *
 * This component reads and writes directly to the global state object.
 * The count value lives at globalState.count and is accessible by ANY component.
 *
 * Global state keys:
 *   - count (number) : The current counter value.
 *
 * Global handlers (registered as "increment", "decrement", "count_reset"):
 *   - increment   : Add 1 to count.
 *   - decrement   : Subtract 1 from count.
 *   - count_reset : Reset count to 0.
 *
 * WHY GLOBAL STATE?
 *   This is a demo of the global approach. The count is stored directly in
 *   the shared state object, so any other component could read or modify it:
 *
 *     // From ANY other component:
 *     const count = app.getState("count");      // read
 *     app.setState("count", 100);                // write (overwrites!)
 *
 *   This is simple but risky — if another component also uses a key called
 *   "count", they'll collide. For real apps, prefer local scope unless the
 *   data genuinely needs to be shared.
 *
 * COMPARISON WITH LOCAL SCOPE:
 *   If this used local scope, it would look like:
 *     const scope = app.createScope("counter");
 *     scope.setState("count", 0);    // private, no collision risk
 *
 *   But since we're demonstrating global state, we use app.setState() directly.
 */
import counterSheet from "./counter.css" with { type: "css" };

export function CounterComponent(app) {
  app.criticalStylesheet(counterSheet);
  // ── Initial State (Global) ──
  // This value is stored in the shared globalState object.
  app.setState("count", 0);

  // ── Event Handlers (Global) ──
  // These are registered as global handlers (no namespace prefix).
  // Be careful: another component registering "increment" would overwrite this.

  app.on("increment", () => {
    app.setState("count", app.getState("count") + 1);
  });

  app.on("decrement", () => {
    app.setState("count", app.getState("count") - 1);
  });

  app.on("count_reset", () => {
    app.setState("count", 0);
  });
  // ── Render Function ──
  // Receives globalState from mount(), reads count directly from it.

  return (globalState) => {
    return `
      <div class="component counter">
        <h2>Counter <span class="badge badge-global">Global State</span></h2>
        <p class="count-display">${globalState.count}</p>
        <div class="btn-group">
          <button class="btn btn-primary" data-on='{"click":"decrement"}'>-</button>
          <button class="btn btn-secondary" data-on='{"click":"count_reset"}'>Reset</button>
          <button class="btn btn-primary" data-on='{"click":"increment"}'>+</button>
        </div>
        <p class="state-hint">
          Any component can read this: app.getState("count") → ${globalState.count}
        </p>
      </div>
    `;
  };
}
