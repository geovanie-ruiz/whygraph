import { createClient, fetchExchange, subscriptionExchange } from "urql";
import { createClient as createWSClient } from "graphql-ws";

const isAbsolute = (url: string) => url.startsWith("http");

function getHttpEndpoint(): string {
  if (typeof window !== "undefined" && !isAbsolute(window.location.href)) {
    return "/api/graphql";
  }
  return import.meta.env.VITE_GRAPHQL_HTTP ?? "http://localhost:4777/api/graphql";
}

function getWsEndpoint(): string {
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    // In dev with Vite proxy, connect through the proxy
    if (import.meta.env.DEV) {
      return `${proto}//${window.location.host}/api/graphql`;
    }
  }
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
        const input = { ...request, query: request.query || "" };
        return {
          subscribe(sink) {
            const unsubscribe = wsClient.subscribe(input, sink);
            return { unsubscribe };
          },
        };
      },
    }),
  ],
});
