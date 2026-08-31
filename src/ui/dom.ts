type Attrs = Record<string, string | boolean | number | ((event: Event) => void)>;
type Child = Node | string | null | undefined | false;

/**
 * Tiny element builder. Text always goes through textContent, so PR titles and
 * error messages coming from GitHub can never be interpreted as markup.
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: Child[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (typeof value === 'function') {
      node.addEventListener(key.replace(/^on/, '').toLowerCase(), value);
    } else if (value === false) {
      continue;
    } else if (value === true) {
      node.setAttribute(key, '');
    } else {
      node.setAttribute(key, String(value));
    }
  }

  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child);
  }

  return node;
}

/** Static, trusted SVG markup only. */
export function icon(markup: string, className?: string): HTMLSpanElement {
  const span = document.createElement('span');
  if (className) span.className = className;
  span.style.display = 'flex';
  span.innerHTML = markup;
  return span;
}

export function clear(node: HTMLElement): void {
  node.replaceChildren();
}
