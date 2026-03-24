import { useState, useEffect } from "react";
import { useQuery } from "urql";

const GAPS_QUERY = `
  query Gaps {
    gaps {
      id
      label
      name
    }
  }
`;

interface GapNode {
  id: string;
  label: string;
  name: string;
}

export interface GapHighlightProps {
  onGapIdsChange: (gapIds: Set<string>) => void;
}

export function GapHighlight({ onGapIdsChange }: GapHighlightProps) {
  const [enabled, setEnabled] = useState(false);
  const [result] = useQuery<{ gaps: GapNode[] }>({
    query: GAPS_QUERY,
  });

  const gaps = result.data?.gaps ?? [];
  const gapCount = gaps.length;

  useEffect(() => {
    if (enabled) {
      onGapIdsChange(new Set(gaps.map((g) => g.id)));
    } else {
      onGapIdsChange(new Set());
    }
  }, [enabled, gaps, onGapIdsChange]);

  const handleToggle = () => {
    setEnabled((prev) => !prev);
  };

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
      <button
        type="button"
        onClick={handleToggle}
        aria-pressed={enabled}
        style={{
          padding: "0.25rem 0.75rem",
          borderRadius: "4px",
          border: "1px solid #ccc",
          backgroundColor: enabled ? "#ff6b35" : "#fff",
          color: enabled ? "#fff" : "#333",
          cursor: "pointer",
        }}
      >
        {enabled ? "Hide Gaps" : "Show Gaps"}
      </button>
      <span data-testid="gap-count">
        {gapCount} gap{gapCount !== 1 ? "s" : ""}
      </span>
    </div>
  );
}
