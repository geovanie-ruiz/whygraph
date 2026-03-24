import { useState, useCallback } from "react";
import "../styles/components/tag-filter.css";

const ALL_TAGS = [
  "arch",
  "data",
  "security",
  "performance",
  "integration",
  "infra",
  "ux",
] as const;

export type DecisionTag = (typeof ALL_TAGS)[number];

export interface TagFilterProps {
  onTagsChange: (selectedTags: Set<DecisionTag>) => void;
}

export function TagFilter({ onTagsChange }: TagFilterProps) {
  const [selectedTags, setSelectedTags] = useState<Set<DecisionTag>>(new Set());

  const handleToggleTag = useCallback(
    (tag: DecisionTag) => {
      setSelectedTags((prev) => {
        const next = new Set(prev);
        if (next.has(tag)) {
          next.delete(tag);
        } else {
          next.add(tag);
        }
        onTagsChange(next);
        return next;
      });
    },
    [onTagsChange],
  );

  const handleClear = useCallback(() => {
    setSelectedTags(new Set());
    onTagsChange(new Set());
  }, [onTagsChange]);

  return (
    <div className="tag-filter">
      {ALL_TAGS.map((tag) => (
        <button
          key={tag}
          type="button"
          className="tag-chip"
          role="checkbox"
          aria-checked={selectedTags.has(tag)}
          onClick={() => handleToggleTag(tag)}
        >
          {tag}
        </button>
      ))}
      {selectedTags.size > 0 && (
        <button
          type="button"
          className="tag-chip--clear"
          onClick={handleClear}
        >
          Clear
        </button>
      )}
    </div>
  );
}
