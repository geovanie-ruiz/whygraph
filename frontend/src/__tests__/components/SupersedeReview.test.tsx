import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { Provider } from "urql";
import { fromValue, never } from "wonka";
import { SupersedeReview } from "../../components/SupersedeReview.js";

const sampleCandidates = [
  {
    newDecisionId: "wg-d2",
    existingDecisionId: "wg-d1",
    sharedNodeIds: ["api-module"],
  },
];

function makeClient(
  candidates: unknown[],
  options?: { mutationFn?: (...args: unknown[]) => unknown },
) {
  return {
    executeQuery: () => {
      // Return data that satisfies both the candidates query and the entity query.
      // urql calls executeQuery for each useQuery hook. Since both queries run,
      // we return a merged result that has all expected fields.
      return fromValue({
        data: {
          supersedeCandidates: candidates,
          entity: {
            __typename: "DecisionNode",
            id: "mock",
            title: "Mock Decision Title",
          },
        },
      });
    },
    executeMutation: options?.mutationFn
      ? options.mutationFn
      : () => fromValue({ data: { updateEntity: { id: "wg-d1", status: "superseded" } } }),
    executeSubscription: () => never,
  } as never;
}

describe("SupersedeReview", () => {
  it("renders candidate pairs", () => {
    const client = makeClient(sampleCandidates);

    render(
      <Provider value={client}>
        <SupersedeReview />
      </Provider>,
    );

    expect(screen.getByTestId("supersede-review")).toBeDefined();
    expect(screen.getByTestId("candidate-wg-d2-wg-d1")).toBeDefined();
    expect(screen.getByText("api-module")).toBeDefined();
  });

  it("renders empty state when no candidates", () => {
    const client = makeClient([]);

    render(
      <Provider value={client}>
        <SupersedeReview />
      </Provider>,
    );

    expect(screen.getByTestId("supersede-empty")).toBeDefined();
    expect(screen.getByText("No supersede candidates to review.")).toBeDefined();
  });

  it("approve button calls mutation", async () => {
    const mutationFn = vi.fn(() =>
      fromValue({ data: { updateEntity: { id: "wg-d1", status: "superseded" } } }),
    );
    const client = makeClient(sampleCandidates, { mutationFn });

    render(
      <Provider value={client}>
        <SupersedeReview />
      </Provider>,
    );

    const approveBtn = screen.getByText("Approve");
    await act(async () => {
      approveBtn.click();
    });

    expect(mutationFn).toHaveBeenCalled();
  });

  it("dismiss button removes candidate from view", async () => {
    const client = makeClient(sampleCandidates);

    render(
      <Provider value={client}>
        <SupersedeReview />
      </Provider>,
    );

    expect(screen.getByTestId("candidate-wg-d2-wg-d1")).toBeDefined();

    const dismissBtn = screen.getByText("Dismiss");
    await act(async () => {
      dismissBtn.click();
    });

    expect(screen.queryByTestId("candidate-wg-d2-wg-d1")).toBeNull();
    expect(screen.getByTestId("supersede-empty")).toBeDefined();
  });

  it("shows loading state", () => {
    const client = {
      executeQuery: () => never,
      executeMutation: () => fromValue({ data: {} }),
      executeSubscription: () => never,
    } as never;

    render(
      <Provider value={client}>
        <SupersedeReview />
      </Provider>,
    );

    expect(screen.getByText("Loading candidates...")).toBeDefined();
  });

  it("shows error state", () => {
    const client = {
      executeQuery: () =>
        fromValue({
          data: null,
          error: { message: "Network failure", name: "CombinedError" },
        }),
      executeMutation: () => fromValue({ data: {} }),
      executeSubscription: () => never,
    } as never;

    render(
      <Provider value={client}>
        <SupersedeReview />
      </Provider>,
    );

    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByText(/Network failure/)).toBeDefined();
  });
});
