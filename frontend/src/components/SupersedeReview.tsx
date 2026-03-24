import { useState, useCallback } from "react";
import { useQuery, useMutation } from "urql";
import "../styles/components/supersede-review.css";

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
      className="supersede-card"
      data-testid={`candidate-${candidate.newDecisionId}-${candidate.existingDecisionId}`}
    >
      <div className="supersede-card__row">
        <strong>New:</strong> {newTitle}
      </div>
      <div className="supersede-card__row">
        <strong>Existing:</strong> {existingTitle}
      </div>
      <div className="supersede-card__shared">
        <strong>Shared nodes:</strong> {candidate.sharedNodeIds.join(", ")}
      </div>
      <div className="supersede-card__actions">
        <button
          className="btn-approve"
          onClick={() => onApprove(candidate)}
        >
          Approve
        </button>
        <button
          className="btn-dismiss"
          onClick={() => onDismiss(candidate)}
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
    <div className="supersede-review" data-testid="supersede-review">
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
