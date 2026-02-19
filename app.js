/**
 * app.js
 * Main entry point — imports all components and mounts the app.
 *
 * ARCHITECTURE:
 * -------------
 * This app demonstrates two state management approaches:
 *
 * 1. LOCAL SCOPE (app.createScope):
 *    - Timer: uses app.createScope("timer") — state is private.
 *    - Todo: uses app.createScope("todo") — with child scopes for molecules.
 *    → Components own their state. Other components can't accidentally modify it.
 *    → Child components access parent scope via app.getScope("scopeName").
 *
 * 2. GLOBAL STATE (app.setState):
 *    - Counter: reads/writes global state directly (globalState.count).
 *    - Phone Form: reads/writes global state directly (globalState.phone_*).
 *    → State is shared across ALL components. Any component can read/write.
 *    → Simpler for small apps, but risk of key collisions in large apps.
 *
 * WHEN TO USE WHICH:
 * ------------------
 * - Use GLOBAL state for data that multiple unrelated components need:
 *   e.g., user info, theme, app-wide settings.
 *
 * - Use LOCAL scope for component-specific data:
 *   e.g., form inputs, toggle states, internal counters.
 *
 * - You can mix both: a component can use local scope for its own data
 *   AND read global state for shared data (via scope.getGlobal("key")).
 */

import { createApp } from "./lib/act.js";
import { TimerComponent } from "./components/timer.js";
import { CounterComponent } from "./components/counter.js";
import { PhoneFormComponent } from "./components/phone-form.js";
import { TodoComponent } from "./components/todos/todo.js";

// Create the app instance attached to #root
const app = createApp(document.getElementById("root"));

// ─────────────────────────────────────────────────────────────
// GLOBAL STATE
// These values are accessible by ANY component via app.getState()
// ─────────────────────────────────────────────────────────────
app.setState("appName", "Act - Examples");
app.setState("theme", "dark");

// ─────────────────────────────────────────────────────────────
// COMPONENTS
// Timer & Todo → LOCAL scope (private state)
// Counter & Phone Form → GLOBAL state (shared state)
// ─────────────────────────────────────────────────────────────
const renderTimer = TimerComponent(app); // Local scope: "timer"
const renderCounter = CounterComponent(app); // Global state: count
const renderPhoneForm = PhoneFormComponent(app); // Global state: phone_*
const renderTodo = TodoComponent(app); // Local scope: "todo", "todoInput", "todoFilter", "todoList"

// ─────────────────────────────────────────────────────────────
// MOUNT
// The render function receives globalState as its argument.
// Components using local scope don't need globalState — they
// read from their own scope internally.
// ─────────────────────────────────────────────────────────────
app.mount(
  (globalState) => app.html`
  <div class="app">
    <h1>${globalState.appName}</h1>

    <div class="components-grid">
      <!-- LOCAL SCOPE: Timer manages its own state -->
      ${renderTimer()}

      <!-- GLOBAL STATE: Counter reads/writes globalState.count -->
      ${renderCounter(globalState)}

      <!-- GLOBAL STATE: Phone Form reads/writes globalState.phone_* -->
      ${renderPhoneForm(globalState)}

      <!-- LOCAL SCOPE: Todo and its molecules manage their own scopes -->
      ${renderTodo()}
    </div>
  </div>
`
);

// Cleanup on page unload
window.addEventListener("beforeunload", () => app.destroy());
