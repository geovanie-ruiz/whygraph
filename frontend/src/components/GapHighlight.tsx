import { useState, useEffect, useMemo } from "react";
import { useQuery } from "urql";
import "../styles/components/gap-highlight.css";

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

  const gaps = useMemo(() => result.data?.gaps ?? [], [result.data?.gaps]);
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
    <div className="gap-toggle">
      <button
        type="button"
        className="gap-toggle__btn"
        onClick={handleToggle}
        aria-pressed={enabled}
      >
        {enabled ? "Hide Gaps" : "Show Gaps"}
      </button>
      <span className="gap-toggle__count" data-testid="gap-count">
        {gapCount} gap{gapCount !== 1 ? "s" : ""}
      </span>
    </div>
  );
}
