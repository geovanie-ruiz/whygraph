import { useState, useCallback } from "react";

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
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
      {ALL_TAGS.map((tag) => (
        <button
          key={tag}
          type="button"
          role="checkbox"
          aria-checked={selectedTags.has(tag)}
          onClick={() => handleToggleTag(tag)}
          style={{
            padding: "0.25rem 0.5rem",
            borderRadius: "4px",
            border: "1px solid #ccc",
            backgroundColor: selectedTags.has(tag) ? "#2b8a8a" : "#fff",
            color: selectedTags.has(tag) ? "#fff" : "#333",
            cursor: "pointer",
            fontSize: "12px",
          }}
        >
          {tag}
        </button>
      ))}
      {selectedTags.size > 0 && (
        <button
          type="button"
          onClick={handleClear}
          style={{
            padding: "0.25rem 0.5rem",
            borderRadius: "4px",
            border: "1px solid #ccc",
            backgroundColor: "#f0f0f0",
            cursor: "pointer",
            fontSize: "12px",
          }}
        >
          Clear
        </button>
      )}
    </div>
  );
}
