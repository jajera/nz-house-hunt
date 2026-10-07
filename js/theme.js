/**
 * Theme toggle matching guides.johna.kiwi:
 * cycles auto → light → dark via a pill icon button.
 * Persistence key: localStorage "theme" = light | dark (absent = auto).
 */

const STORAGE_KEY = "theme";
const MODES = ["auto", "light", "dark"];
const LABELS = {
  auto: "Colour theme: system",
  light: "Colour theme: light",
  dark: "Colour theme: dark",
};

function currentMode() {
  const t = document.documentElement.dataset.theme;
  return t === "light" || t === "dark" ? t : "auto";
}

/** @param {'auto'|'light'|'dark'} mode */
export function applyTheme(mode) {
  const root = document.documentElement;
  if (mode === "auto") {
    delete root.dataset.theme;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  } else {
    root.dataset.theme = mode;
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }
}

/**
 * @param {HTMLButtonElement | null} button
 * @param {HTMLElement | null} label
 */
export function initTheme(button, label) {
  if (!button || !label) return;

  const syncChrome = (mode) => {
    label.textContent = LABELS[mode];
    button.setAttribute("title", LABELS[mode]);
    button.setAttribute("aria-label", LABELS[mode]);
  };

  // Honour stored preference (early inline script may already have set dataset)
  let mode = currentMode();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") mode = stored;
    else mode = "auto";
  } catch {
    /* ignore */
  }
  applyTheme(mode);
  syncChrome(mode);
  button.hidden = false;

  button.addEventListener("click", () => {
    const next = MODES[(MODES.indexOf(currentMode()) + 1) % MODES.length];
    applyTheme(next);
    syncChrome(next);
  });
}
