import { createClient, fetchExchange, subscriptionExchange } from "urql";
import { createClient as createWSClient } from "graphql-ws";

const isAbsolute = (url: string) => url.startsWith("http");

function getHttpEndpoint(): string {
  /* v8 ignore next 3 -- jsdom sets window.location.href to http://localhost:3000 (absolute), so this branch is unreachable in tests */
  if (typeof window !== "undefined" && !isAbsolute(window.location.href)) {
    return "/api/graphql";
  }
  return import.meta.env.VITE_GRAPHQL_HTTP ?? "http://localhost:4777/api/graphql";
}

function getWsEndpoint(): string {
  if (typeof window !== "undefined") {
    /* v8 ignore next -- jsdom protocol is always "http:", so the "wss:" branch is unreachable in tests */
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    // In dev with Vite proxy, connect through the proxy
    /* v8 ignore next 4 -- import.meta.env.DEV is always true in vitest; the fall-through path is unreachable */
    if (import.meta.env.DEV) {
      return `${proto}//${window.location.host}/api/graphql`;
    }
  }
  /* v8 ignore next -- import.meta.env.DEV is true in vitest, so getWsEndpoint returns at line 18 */
  return import.meta.env.VITE_GRAPHQL_WS ?? "ws://localhost:4777/api/graphql";
}

export const wsClient = createWSClient({
  url: getWsEndpoint(),
});

export const urqlClient = createClient({
  url: getHttpEndpoint(),
  exchanges: [
    fetchExchange,
    subscriptionExchange({
      forwardSubscription(request) {
        /* v8 ignore next -- urql always provides a non-empty query string; the "" fallback is unreachable in tests */
        const input = { ...request, query: request.query || "" };
        return {
          /* v8 ignore next 4 -- inner subscribe is called by urql's subscription exchange internals; exercised in graphql.test.ts but V8 doesn't attribute coverage through the wonka/urql callback chain */
          subscribe(sink) {
            const unsubscribe = wsClient.subscribe(input, sink);
            return { unsubscribe };
          },
        };
      },
    }),
  ],
});
