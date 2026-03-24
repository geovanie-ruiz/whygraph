import type { ReactNode } from "react";

export interface HeaderProps {
  connected: boolean;
  menuOpen: boolean;
  onMenuToggle: () => void;
  children?: ReactNode;
}

export function Header({ connected, menuOpen, onMenuToggle, children }: HeaderProps) {
  return (
    <header className="app-header">
      <span className="app-header__logo">whygraph</span>
      <span className="app-header__subtitle">Graph Visualization Tool</span>
      <span className={`badge ${connected ? "badge--success" : "badge--error"}`}>
        {connected ? "Connected" : "Connecting..."}
      </span>
      <div className="app-header__spacer" />
      <button
        type="button"
        className={`app-header__menu-btn${menuOpen ? " app-header__menu-btn--active" : ""}`}
        onClick={onMenuToggle}
      >
        Menu
      </button>
      {children}
    </header>
  );
}
