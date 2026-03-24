import { useState, useCallback, useEffect } from "react";
import { useQuery } from "urql";
import "../styles/components/decision-list.css";

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
    <div className="decision-list" data-testid="decision-list">
      <div className="decision-list__controls">
        <input
          type="text"
          className="decision-list__search"
          placeholder="Search decisions..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          aria-label="Search decisions"
        />
        <select
          className="decision-list__status-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="superseded">Superseded</option>
        </select>
      </div>

      <div className="decision-list__tags">
        {ALL_TAGS.map((tag) => (
          <button
            key={tag}
            className="tag-chip"
            onClick={() => handleTagToggle(tag)}
            aria-pressed={selectedTags.includes(tag)}
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
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Date</th>
              <th>Tags</th>
              <th>Affects</th>
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
                <td>{d.title}</td>
                <td>{d.status}</td>
                <td>{d.date}</td>
                <td>{d.tags.join(", ")}</td>
                <td>{d.affects.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
