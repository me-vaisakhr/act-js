/**
 * TodoFilter (Molecule)
 * ─────────────────────
 * STATE: LOCAL SCOPE ("todoFilter")
 *
 * Handles the filter buttons (All / Active / Done) and "Clear completed" action.
 *
 * Own scope state:
 *   - current (string) : Active filter — "all", "active", or "completed".
 *
 * Reads from parent scope ("todo"):
 *   - items (array) : Todo list (to compute counts per filter).
 *
 * Writes to parent scope ("todo"):
 *   - items : Removes completed items on "Clear completed".
 *
 * Scoped handlers:
 *   - todoFilter:all            : Set filter to "all".
 *   - todoFilter:active         : Set filter to "active".
 *   - todoFilter:completed      : Set filter to "completed".
 *   - todoFilter:clearCompleted : Remove all completed todos.
 */
export function TodoFilter(app) {
  // Own scope — owns the current filter value
  const scope = app.createScope("todoFilter");
  scope.setState("current", "all");

  // ── Scoped Handlers ──

  scope.on("all", () => scope.setState("current", "all"));
  scope.on("active", () => scope.setState("current", "active"));
  scope.on("completed", () => scope.setState("current", "completed"));

  scope.on("clearCompleted", () => {
    // Access parent scope to modify the shared items list
    const todo = app.getScope("todo");
    const items = todo.getState("items").filter((item) => !item.completed);
    todo.setState("items", items);
  });

  // ── Render Function ──
  return () => {
    const filter = scope.getState("current");
    const items = app.getScope("todo").getState("items");
    const activeCount = items.filter((i) => !i.completed).length;
    const completedCount = items.filter((i) => i.completed).length;

    return `
        <div class="todo-filter-bar">
          <div class="todo-filters">
            <button class="btn btn-filter ${
              filter === "all" ? "active" : ""
            }" data-on='{"click":"${scope.handler("all")}"}'>All (${
      items.length
    })</button>
            <button class="btn btn-filter ${
              filter === "active" ? "active" : ""
            }" data-on='{"click":"${scope.handler(
      "active"
    )}"}'>Active (${activeCount})</button>
            <button class="btn btn-filter ${
              filter === "completed" ? "active" : ""
            }" data-on='{"click":"${scope.handler(
      "completed"
    )}"}'>Done (${completedCount})</button>
          </div>
          ${
            completedCount > 0
              ? `<button class="btn btn-danger btn-small" data-on='{"click":"${scope.handler(
                  "clearCompleted"
                )}"}'>Clear completed (${completedCount})</button>`
              : ""
          }
        </div>
      `;
  };
}
