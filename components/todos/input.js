/**
 * TodoInput (Molecule)
 * ────────────────────
 * STATE: LOCAL SCOPE ("todoInput")
 *
 * Handles the text input and "Add" button for creating new todos.
 *
 * Own scope state:
 *   - text (string) : Current input value.
 *
 * Reads from parent scope ("todo"):
 *   - items   (array)  : Current todo list (to append new items).
 *   - nextId  (number) : Next available ID for new todos.
 *
 * Writes to parent scope ("todo"):
 *   - items   : Appends the new todo item.
 *   - nextId  : Increments after adding.
 *
 * Scoped handlers:
 *   - todoInput:input   : Updates input text on keystroke.
 *   - todoInput:keydown : Adds todo on Enter key.
 *   - todoInput:add     : Adds todo on button click.
 */
export function TodoInput(app) {
  // Own scope — private state for this molecule
  const scope = app.createScope("todoInput");
  scope.setState("text", "");

  /**
   * Add a new todo item.
   * Reads from own scope (text) and parent scope (items, nextId).
   * Writes to parent scope (items, nextId) and resets own input.
   */
  function addTodo() {
    const text = scope.getState("text").trim();
    if (!text) return;

    // Access the parent's scope by name — no argument passing needed
    const todo = app.getScope("todo");
    const id = todo.getState("nextId");
    const items = [...todo.getState("items"), { id, text, completed: false }];

    todo.setState("items", items);
    todo.setState("nextId", id + 1);
    scope.setState("text", "");
  }

  // ── Scoped Handlers ──
  // Registered as "todoInput:input", "todoInput:keydown", "todoInput:add"

  scope.on("input", (e) => {
    scope.setState("text", e.target.value);
  });

  scope.on("keydown", (e) => {
    if (e.key === "Enter") addTodo();
  });

  scope.on("add", () => addTodo());

  // ── Render Function ──
  return () => {
    const text = scope.getState("text");

    return `
        <div class="todo-input-row">
          <input
            type="text"
            data-id="todo-input"
            value="${text}"
            placeholder="What needs to be done?"
            data-on='{"input":"${scope.handler(
              "input"
            )}","keydown":"${scope.handler("keydown")}"}'
          />
          <button class="btn btn-success" data-on='{"click":"${scope.handler(
            "add"
          )}"}'>Add</button>
        </div>
      `;
  };
}
