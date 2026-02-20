/**
 * TimerComponent
 * ──────────────
 * STATE: LOCAL SCOPE ("timer")
 *
 * This component uses app.createScope("timer") to manage its state privately.
 * No other component can accidentally modify the timer's seconds or running status.
 *
 * Scope state:
 *   - seconds  (number)  : Elapsed seconds since start.
 *   - running  (boolean) : Whether the timer is currently active.
 *
 * Scoped handlers (auto-namespaced as "timer:start", "timer:stop", "timer:reset"):
 *   - start : Begin counting. Uses app.safeSetInterval for memory-safe tracking.
 *   - stop  : Pause counting. Clears the interval.
 *   - reset : Stop and reset seconds to 0.
 *
 * WHY LOCAL SCOPE?
 *   The timer's state (seconds, running) is purely internal — no other component
 *   needs to know how many seconds have elapsed. Local scope keeps it isolated.
 *
 *   If another component DID need the timer's value, it could still access it:
 *     const timerSeconds = app.getScope("timer").getState("seconds");
 */
import timerSheet from "./timer.css" with { type: "css" };

export function TimerComponent(app) {
  app.criticalStylesheet(timerSheet);
  // Create a private scope for this component
  const scope = app.createScope("timer");

  // Track interval ID outside of state (not reactive, just a reference)
  let intervalId = null;

  // ── Initial State ──
  scope.setState("seconds", 0);
  scope.setState("running", false);

  // ── Event Handlers ──

  scope.on("start", () => {
    // Prevent multiple intervals if already running
    if (scope.getState("running")) return;
    scope.setState("running", true);

    // safeSetInterval is tracked by the app for cleanup on destroy()
    intervalId = app.safeSetInterval(() => {
      scope.setState("seconds", scope.getState("seconds") + 1);
    }, 1000);
  });

  scope.on("stop", () => {
    app.safeClearInterval(intervalId);
    intervalId = null;
    scope.setState("running", false);
  });

  scope.on("reset", () => {
    app.safeClearInterval(intervalId);
    intervalId = null;
    scope.setState("running", false);
    scope.setState("seconds", 0);
  });

  // ── Render Function ──
  // Reads only from its own scope — no globalState needed.

  return () => {
    const totalSeconds = scope.getState("seconds");
    const running = scope.getState("running");

    // Format as HH:MM:SS
    const hrs = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const mins = String(Math.floor((totalSeconds % 3600) / 60)).padStart(
      2,
      "0"
    );
    const secs = String(totalSeconds % 60).padStart(2, "0");

    return `
      <div class="component timer">
        <h2>Timer <span class="badge">Local Scope</span></h2>
        <p class="timer-display">${hrs}:${mins}:${secs}</p>
        <div class="btn-group">
          ${
            running
              ? `<button class="btn btn-danger" data-on='{"click":"${scope.handler(
                  "stop"
                )}"}'>Stop</button>`
              : `<button class="btn btn-success" data-on='{"click":"${scope.handler(
                  "start"
                )}"}'>Start</button>`
          }
          <button class="btn btn-secondary" data-on='{"click":"${scope.handler(
            "reset"
          )}"}'>Reset</button>
        </div>
      </div>
    `;
  };
}
