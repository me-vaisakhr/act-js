'use strict';

/**
 * lib/diff.js — Minimal DOM patch algorithm
 *
 * Walks two DOM trees in parallel and applies only the changes:
 *   - Text content changes
 *   - Attribute additions / removals / updates
 *   - Node insertions and removals
 *   - Tag replacements (different element types)
 *
 * The .value property on inputs is synced only when it actually differs,
 * so the cursor is never reset while the user is typing.
 *
 * Usage (in act.js):
 *   import { reconcileChildren } from './diff.js';
 *   reconcileChildren(container, newContentFragment);
 */

/** Sync attributes from newEl onto oldEl. */
function syncAttrs(oldEl, newEl) {
  // Remove attrs no longer present in new
  for (const { name } of [...oldEl.attributes]) {
    if (!newEl.hasAttribute(name)) oldEl.removeAttribute(name);
  }
  // Add / update attrs that changed
  for (const { name, value } of newEl.attributes) {
    if (oldEl.getAttribute(name) !== value) {
      oldEl.setAttribute(name, value);
      // Sync .value property for inputs — but only if it actually differs.
      // Skipping when equal avoids resetting the cursor while the user types.
      if (name === 'value' && 'value' in oldEl && oldEl.value !== value) {
        oldEl.value = value;
      }
    }
  }
}

/** Recursively diff and patch two nodes in place. */
function patch(oldParent, oldNode, newNode) {
  // Different node types (e.g. element vs text) → replace entirely
  if (oldNode.nodeType !== newNode.nodeType) {
    oldParent.replaceChild(newNode.cloneNode(true), oldNode);
    return;
  }
  // Text node → update content if changed
  if (newNode.nodeType === Node.TEXT_NODE) {
    if (oldNode.textContent !== newNode.textContent)
      oldNode.textContent = newNode.textContent;
    return;
  }
  // Non-element node (comment, processing instruction, etc.) — leave as-is
  if (newNode.nodeType !== Node.ELEMENT_NODE) return;
  // Element: different tag → replace entirely
  if (oldNode.nodeName !== newNode.nodeName) {
    oldParent.replaceChild(newNode.cloneNode(true), oldNode);
    return;
  }
  // Element: same tag → sync attributes, then recurse into children
  syncAttrs(oldNode, newNode);
  reconcileChildren(oldNode, newNode);
}

/**
 * Align the child node lists of two elements.
 * This is the entry point called from act.js on every re-render.
 *
 * @param {Node} oldEl - Existing DOM node (or container).
 * @param {Node} newEl - New DOM node (or DocumentFragment) with desired content.
 */
export function reconcileChildren(oldEl, newEl) {
  const oldCh = [...oldEl.childNodes];
  const newCh = [...newEl.childNodes];
  const len = Math.max(oldCh.length, newCh.length);
  for (let i = 0; i < len; i++) {
    if (i >= oldCh.length) {
      oldEl.appendChild(newCh[i].cloneNode(true));
    } else if (i >= newCh.length) {
      oldEl.removeChild(oldCh[i]);
    } else {
      patch(oldEl, oldCh[i], newCh[i]);
    }
  }
}
