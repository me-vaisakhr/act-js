/**
 * TodoList (Molecule)
 * ───────────────────
 * STATE: LOCAL SCOPE ("todoList")
 *
 * Handles rendering the filtered todo items, toggling completion, and deleting.
 *
 * Own scope state:
 *   (none — this molecule only has handlers, no private state)
 *
 * Reads from parent scope ("todo"):
 *   - items (array) : The full todo list.
 *
 * Reads from sibling scope ("todoFilter"):
 *   - current (string) : The active filter to apply.
 *
 * Writes to parent scope ("todo"):
 *   - items : Updates on toggle (flip completed) or delete (remove item).
 *
 * Scoped handlers:
 *   - todoList:toggle : Toggle an item's completed status.
 *   - todoList:delete : Remove an item from the list.
 *
 * NOTE ON CROSS-SCOPE ACCESS:
 *   This molecule reads from two different scopes:
 *     - app.getScope("todo")       → parent's items
 *     - app.getScope("todoFilter") → sibling's filter
 *
 *   This is the power of getScope — no prop drilling, no argument passing.
 *   Any component can access any scope by name, as long as it's been created.
 */
export function TodoList(app) {
  // Own scope — used for namespacing handlers only
  const scope = app.createScope("todoList");

  // ── Scoped Handlers ──

  /**
   * Toggle a todo item's completed status.
   * Reads the item ID from the clicked element's data-todo-id attribute.
   */
  scope.on("toggle", (e) => {
    const todo = app.getScope("todo");
    const id = Number(e.currentTarget.getAttribute("data-todo-id"));
    const items = todo
      .getState("items")
      .map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      );
    todo.setState("items", items);
  });

  /**
   * Delete a todo item.
   * Reads the item ID from the clicked element's data-todo-id attribute.
   */
  scope.on("delete", (e) => {
    const todo = app.getScope("todo");
    const id = Number(e.currentTarget.getAttribute("data-todo-id"));
    const items = todo.getState("items").filter((item) => item.id !== id);
    todo.setState("items", items);
  });

  // ── Render Function ──
  return () => {
    // Read from sibling scope (filter) and parent scope (items)
    const filter = app.getScope("todoFilter").getState("current");
    const items = app.getScope("todo").getState("items");

    // Apply the active filter
    const filtered = items.filter((item) => {
      if (filter === "active") return !item.completed;
      if (filter === "completed") return item.completed;
      return true;
    });

    // Empty state
    if (filtered.length === 0) {
      const msg =
        items.length === 0
          ? "No todos yet. Add one above!"
          : "No matching todos.";

      return `<ul class="todo-list"><li class="todo-empty">${msg}</li></ul>`;
    }

    // Render filtered items
    const listItems = filtered
      .map(
        (item) => `
          <li class="todo-item ${item.completed ? "completed" : ""}">
            <button
              class="todo-checkbox ${item.completed ? "checked" : ""}"
              data-todo-id="${item.id}"
              data-on='{"click":"${scope.handler("toggle")}"}'
            >${item.completed ? "✓" : ""}</button>
            <span class="todo-text">${item.text}</span>
            <button
              class="todo-delete"
              data-todo-id="${item.id}"
              data-on='{"click":"${scope.handler("delete")}"}'
            >✕</button>
          </li>
        `
      )
      .join("");

    return `<ul class="todo-list">${listItems}</ul>`;
  };
}
