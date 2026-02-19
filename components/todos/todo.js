/**
 * TodoComponent (Parent)
 * ──────────────────────
 * STATE: LOCAL SCOPE ("todo")
 *
 * This is the parent component that composes three molecules:
 *   - TodoInput  → handles text input and adding new todos.
 *   - TodoFilter → handles filtering (all/active/completed).
 *   - TodoList   → handles rendering, toggling, and deleting items.
 *
 * SCOPE HIERARCHY:
 *   app.createScope("todo")        ← Parent: owns items[] and nextId
 *   app.createScope("todoInput")   ← Child: owns input text
 *   app.createScope("todoFilter")  ← Child: owns current filter
 *   app.createScope("todoList")    ← Child: owns toggle/delete handlers
 *
 * HOW MOLECULES COMMUNICATE:
 *   Children access the parent's state via app.getScope("todo"):
 *
 *     // Inside TodoInput:
 *     const todo = app.getScope("todo");
 *     const items = todo.getState("items");   // read parent's items
 *     todo.setState("items", newItems);        // write to parent's items
 *
 *     // Inside TodoList, reading a sibling's state:
 *     const filter = app.getScope("todoFilter").getState("current");
 *
 * WHY LOCAL SCOPE?
 *   The todo's state (items, filter, input text) is component-specific.
 *   Using scopes means:
 *   - No risk of key collisions with counter, timer, or phone form.
 *   - Each molecule's handlers are auto-namespaced (e.g., "todoInput:add").
 *   - Cleanup is automatic — scope.destroy() removes all handlers and state.
 */
import { TodoInput } from "./input.js";
import { TodoFilter } from "./filter.js";
import { TodoList } from "./list.js";

export function TodoComponent(app) {
  // Create the parent scope — owns the shared todo data
  const scope = app.createScope("todo");

  // ── Initial State ──
  scope.setState("items", []); // Array of { id, text, completed }
  scope.setState("nextId", 1); // Auto-incrementing ID for new todos

  // ── Initialize Molecules ──
  // Each molecule only needs the app instance.
  // They grab the parent scope internally via app.getScope("todo").
  const renderInput = TodoInput(app);
  const renderFilter = TodoFilter(app);
  const renderList = TodoList(app);

  // ── Render Function ──
  return () => `
    <div class="component todo">
      <h2>Todos <span class="badge">Local Scope</span></h2>
      ${renderInput()}
      ${renderFilter()}
      ${renderList()}
    </div>
  `;
}
