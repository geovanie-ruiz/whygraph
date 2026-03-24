import { useTheme } from "../lib/theme.js";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isLight = theme === "light";

  return (
    <div className="theme-toggle">
      <span className="theme-toggle__icon" aria-hidden="true">
        {isLight ? "\u2600" : "\u263E"}
      </span>
      <button
        type="button"
        className="theme-toggle__track"
        data-active={isLight}
        onClick={toggle}
        role="switch"
        aria-checked={isLight}
        aria-label="Toggle light mode"
      >
        <span className="theme-toggle__thumb" />
      </button>
    </div>
  );
}
