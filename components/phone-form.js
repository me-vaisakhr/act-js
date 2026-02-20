/**
 * PhoneFormComponent
 * ──────────────────
 * STATE: GLOBAL (app.setState / app.getState)
 *
 * This component stores all its data in the global state with "phone_" prefixed keys.
 * This is the manual namespacing approach — it works, but relies on convention
 * rather than enforcement to prevent collisions.
 *
 * Global state keys:
 *   - phone_input     (string)  : Current phone number input value.
 *   - phone_name      (string)  : Current name input value.
 *   - phone_submitted (boolean) : Whether a contact was just submitted.
 *   - phone_contacts  (array)   : List of saved contacts [{name, phone}].
 *   - phone_error     (string)  : Current validation error message.
 *
 * Global handlers:
 *   - phone_nameInput  : Handles name input changes.
 *   - phone_phoneInput : Handles phone input changes (filters non-numeric chars).
 *   - phone_submit     : Validates and saves a new contact.
 *   - phone_clear      : Clears all saved contacts.
 *
 * WHY GLOBAL STATE?
 *   This is a demo of global state. Notice the manual "phone_" prefix on every key —
 *   this is necessary to avoid collisions with other components.
 *
 *   Compare with the local scope approach (used by Timer):
 *     const scope = app.createScope("phone");
 *     scope.setState("input", "");       // auto-isolated, no prefix needed
 *     scope.on("submit", fn);            // auto-namespaced as "phone:submit"
 *
 *   The global approach requires more discipline but makes state visible everywhere:
 *     // Any component can read the contacts list:
 *     const contacts = app.getState("phone_contacts");
 */
import phoneFormSheet from "./phone-form.css" with { type: "css" };

export function PhoneFormComponent(app) {
  app.criticalStylesheet(phoneFormSheet);
  // ── Initial State (Global) ──
  // All keys are manually prefixed with "phone_" to avoid collisions.
  app.setState("phone_input", "");
  app.setState("phone_name", "");
  app.setState("phone_submitted", false);
  app.setState("phone_contacts", []);
  app.setState("phone_error", "");

  // ── Event Handlers (Global) ──

  app.on("phone_nameInput", (e) => {
    app.setState("phone_submitted", false);
    app.setState("phone_error", "");
    app.setState("phone_name", e.target.value);
  });

  app.on("phone_phoneInput", (e) => {
    // Only allow digits, spaces, dashes, plus, parentheses
    const cleaned = e.target.value.replace(/[^\d\s\-\+\(\)]/g, "");
    app.setState("phone_submitted", false);
    app.setState("phone_error", "");
    app.setState("phone_input", cleaned);
  });

  app.on("phone_submit", () => {
    const name = app.getState("phone_name").trim();
    const phone = app.getState("phone_input").trim();

    // Validate name
    if (!name) {
      app.setState("phone_error", "Please enter a name.");
      return;
    }

    // Validate phone: at least 7 digits
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 7) {
      app.setState(
        "phone_error",
        "Please enter a valid phone number (at least 7 digits)."
      );
      return;
    }

    // Save the contact and reset form
    const contacts = [...app.getState("phone_contacts"), { name, phone }];
    app.setState("phone_contacts", contacts);
    app.setState("phone_name", "");
    app.setState("phone_input", "");
    app.setState("phone_error", "");
    app.setState("phone_submitted", true);
  });

  app.on("phone_clear", () => {
    app.setState("phone_contacts", []);
    app.setState("phone_submitted", false);
  });

  // ── Render Function ──
  // Receives globalState, reads phone_* keys directly.

  return (globalState) => {
    const name = globalState.phone_name;
    const input = globalState.phone_input;
    const error = globalState.phone_error;
    const submitted = globalState.phone_submitted;
    const contacts = globalState.phone_contacts;
    const contactsList = contacts.length
      ? `<ul class="contacts-list">
          ${contacts
            .map((c) => `<li><strong>${c.name}</strong>: ${c.phone}</li>`)
            .join("")}
        </ul>`
      : "";

    return `
      <div class="component phone-form">
        <h2>Contact Form <span class="badge badge-global">Global State</span></h2>

        ${error ? `<p class="error">${error}</p>` : ""}
        ${submitted ? `<p class="success">Contact added!</p>` : ""}

        <div class="form-group">
          <label>Name</label>
          <input
            type="text"
            data-id="name-input"
            value="${name}"
            placeholder="John Doe"
            data-on='{"input":"phone_nameInput"}'
          />
        </div>

        <div class="form-group">
          <label>Phone Number</label>
          <input
            type="tel"
            data-id="phone-input"
            value="${input}"
            placeholder="+1 (555) 123-4567"
            data-on='{"input":"phone_phoneInput"}'
          />
        </div>

        <div class="btn-group">
          <button class="btn btn-success" data-on='{"click":"phone_submit"}'>Submit</button>
          ${
            contacts.length
              ? `<button class="btn btn-danger" data-on='{"click":"phone_clear"}'>Clear All</button>`
              : ""
          }
        </div>

        ${contactsList ? `<h3>Saved Contacts</h3>${contactsList}` : ""}

        <p class="state-hint">
          Any component can read this: app.getState("phone_contacts").length → ${
            contacts.length
          }
        </p>
      </div>
    `;
  };
}
