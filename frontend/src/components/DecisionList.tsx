import { useState, useCallback, useEffect } from "react";
import { useQuery } from "urql";

const DECISIONS_QUERY = `
  query Decisions($status: String, $tags: [String!]) {
    decisions(status: $status, tags: $tags) {
      id
      title
      status
      date
      tags
      affects
    }
  }
`;

const SEARCH_QUERY = `
  query Search($query: String!) {
    search(query: $query) {
      id
      title
      status
      date
      tags
      affects
    }
  }
`;

export interface DecisionSummary {
  id: string;
  title: string;
  status: string;
  date: string;
  tags: string[];
  affects: string[];
}

const ALL_TAGS = ["arch", "data", "security", "performance", "integration", "infra", "ux"] as const;

export interface DecisionListProps {
  onSelect?: (decision: DecisionSummary) => void;
}

export function DecisionList({ onSelect }: DecisionListProps) {
  const [searchText, setSearchText] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const isSearching = debouncedSearch.length > 0;

  const [decisionsResult] = useQuery({
    query: DECISIONS_QUERY,
    variables: {
      status: statusFilter || undefined,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
    },
    pause: isSearching,
  });

  const [searchResult] = useQuery({
    query: SEARCH_QUERY,
    variables: { query: debouncedSearch },
    pause: !isSearching,
  });

  const handleTagToggle = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }, []);

  const decisions: DecisionSummary[] = isSearching
    ? searchResult.data?.search ?? []
    : decisionsResult.data?.decisions ?? [];

  const fetching = isSearching ? searchResult.fetching : decisionsResult.fetching;
  const error = isSearching ? searchResult.error : decisionsResult.error;

  return (
    <div data-testid="decision-list">
      <div style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search decisions..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          aria-label="Search decisions"
          style={{ padding: "0.5rem", flex: "1 1 200px", minWidth: "200px" }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
          style={{ padding: "0.5rem" }}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="superseded">Superseded</option>
        </select>
      </div>

      <div style={{ marginBottom: "1rem", display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
        {ALL_TAGS.map((tag) => (
          <button
            key={tag}
            onClick={() => handleTagToggle(tag)}
            aria-pressed={selectedTags.includes(tag)}
            style={{
              padding: "0.25rem 0.5rem",
              borderRadius: "4px",
              border: "1px solid #ccc",
              backgroundColor: selectedTags.includes(tag) ? "#007bff" : "transparent",
              color: selectedTags.includes(tag) ? "#fff" : "inherit",
              cursor: "pointer",
            }}
          >
            {tag}
          </button>
        ))}
      </div>

      {error && <div role="alert">Error loading decisions: {error.message}</div>}

      {fetching && <div>Loading...</div>}

      {!fetching && decisions.length === 0 && (
        <div data-testid="empty-state">No decisions found</div>
      )}

      {!fetching && decisions.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "2px solid #ddd" }}>Title</th>
              <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "2px solid #ddd" }}>Status</th>
              <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "2px solid #ddd" }}>Date</th>
              <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "2px solid #ddd" }}>Tags</th>
              <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "2px solid #ddd" }}>Affects</th>
            </tr>
          </thead>
          <tbody>
            {decisions.map((d) => (
              <tr
                key={d.id}
                data-testid={`decision-row-${d.id}`}
                onClick={() => onSelect?.(d)}
                style={{ cursor: onSelect ? "pointer" : "default" }}
              >
                <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>{d.title}</td>
                <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>{d.status}</td>
                <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>{d.date}</td>
                <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>{d.tags.join(", ")}</td>
                <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>{d.affects.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
