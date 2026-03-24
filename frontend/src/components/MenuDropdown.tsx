import { useEffect } from "react";
import { ThemeToggle } from "./ThemeToggle.js";
import { TagFilter } from "./TagFilter.js";
import type { DecisionTag } from "./TagFilter.js";
import { GapHighlight } from "./GapHighlight.js";
import { StaleRefBadge } from "./StaleRefBadge.js";
import "../styles/components/menu-dropdown.css";

export interface MenuDropdownProps {
  open: boolean;
  onClose: () => void;
  onTagsChange: (tags: Set<DecisionTag>) => void;
  onGapIdsChange: (gapIds: Set<string>) => void;
  onStaleRefIdsChange: (staleIds: Set<string>) => void;
}

export function MenuDropdown({
  open,
  onClose,
  onTagsChange,
  onGapIdsChange,
  onStaleRefIdsChange,
}: MenuDropdownProps) {
  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="menu-backdrop" onClick={onClose} />
      <div className="menu-dropdown">
        <div className="menu-section">
          <div className="menu-section__title">Theme</div>
          <ThemeToggle />
        </div>
        <div className="menu-section">
          <div className="menu-section__title">Filters</div>
          <TagFilter onTagsChange={onTagsChange} />
        </div>
        <div className="menu-section">
          <GapHighlight onGapIdsChange={onGapIdsChange} />
        </div>
        <div className="menu-section">
          <StaleRefBadge onStaleRefIdsChange={onStaleRefIdsChange} />
        </div>
      </div>
    </>
  );
}
