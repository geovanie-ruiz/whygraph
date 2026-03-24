import { useState, useCallback } from "react";
import { useQuery, useMutation } from "urql";

const SUPERSEDE_CANDIDATES_QUERY = `
  query SupersedeCandidates {
    supersedeCandidates {
      newDecisionId
      existingDecisionId
      sharedNodeIds
    }
  }
`;

const ENTITY_QUERY = `
  query Entity($id: ID!) {
    entity(id: $id) {
      __typename
      ... on DecisionNode {
        id
        title
      }
    }
  }
`;

const UPDATE_ENTITY_MUTATION = `
  mutation UpdateEntity($id: ID!, $status: String) {
    updateEntity(id: $id, status: $status) {
      __typename
      ... on DecisionNode { id status }
      ... on StructuralNode { id status }
    }
  }
`;

export interface SupersedeCandidate {
  newDecisionId: string;
  existingDecisionId: string;
  sharedNodeIds: string[];
}

interface CandidatePairProps {
  candidate: SupersedeCandidate;
  onApprove: (candidate: SupersedeCandidate) => void;
  onDismiss: (candidate: SupersedeCandidate) => void;
}

function CandidatePair({ candidate, onApprove, onDismiss }: CandidatePairProps) {
  const [newResult] = useQuery({
    query: ENTITY_QUERY,
    variables: { id: candidate.newDecisionId },
  });

  const [existingResult] = useQuery({
    query: ENTITY_QUERY,
    variables: { id: candidate.existingDecisionId },
  });

  const newTitle = newResult.data?.entity?.title ?? candidate.newDecisionId;
  const existingTitle = existingResult.data?.entity?.title ?? candidate.existingDecisionId;

  return (
    <div
      data-testid={`candidate-${candidate.newDecisionId}-${candidate.existingDecisionId}`}
      style={{
        border: "1px solid #ddd",
        borderRadius: "8px",
        padding: "1rem",
        marginBottom: "0.75rem",
      }}
    >
      <div style={{ marginBottom: "0.5rem" }}>
        <strong>New:</strong> {newTitle}
      </div>
      <div style={{ marginBottom: "0.5rem" }}>
        <strong>Existing:</strong> {existingTitle}
      </div>
      <div style={{ marginBottom: "0.75rem", fontSize: "0.875rem", color: "#666" }}>
        <strong>Shared nodes:</strong> {candidate.sharedNodeIds.join(", ")}
      </div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          onClick={() => onApprove(candidate)}
          style={{
            padding: "0.25rem 0.75rem",
            backgroundColor: "#28a745",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Approve
        </button>
        <button
          onClick={() => onDismiss(candidate)}
          style={{
            padding: "0.25rem 0.75rem",
            backgroundColor: "#6c757d",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

export function SupersedeReview() {
  const [candidatesResult] = useQuery({ query: SUPERSEDE_CANDIDATES_QUERY });
  const [, updateEntity] = useMutation(UPDATE_ENTITY_MUTATION);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const makeKey = (c: SupersedeCandidate) => `${c.newDecisionId}:${c.existingDecisionId}`;

  const handleApprove = useCallback(
    async (candidate: SupersedeCandidate) => {
      await updateEntity({ id: candidate.existingDecisionId, status: "superseded" });
      setDismissed((prev) => new Set(prev).add(makeKey(candidate)));
    },
    [updateEntity],
  );

  const handleDismiss = useCallback((candidate: SupersedeCandidate) => {
    setDismissed((prev) => new Set(prev).add(makeKey(candidate)));
  }, []);

  const allCandidates: SupersedeCandidate[] =
    candidatesResult.data?.supersedeCandidates ?? [];

  const visibleCandidates = allCandidates.filter((c) => !dismissed.has(makeKey(c)));

  if (candidatesResult.fetching) {
    return <div>Loading candidates...</div>;
  }

  if (candidatesResult.error) {
    return <div role="alert">Error loading candidates: {candidatesResult.error.message}</div>;
  }

  if (visibleCandidates.length === 0) {
    return (
      <div data-testid="supersede-empty">
        No supersede candidates to review.
      </div>
    );
  }

  return (
    <div data-testid="supersede-review">
      <h3>Supersede Candidates ({visibleCandidates.length})</h3>
      {visibleCandidates.map((c) => (
        <CandidatePair
          key={makeKey(c)}
          candidate={c}
          onApprove={handleApprove}
          onDismiss={handleDismiss}
        />
      ))}
    </div>
  );
}
