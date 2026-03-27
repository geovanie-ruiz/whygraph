// Polyfill ResizeObserver for jsdom test environment
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver;
}

// Mock WebSocket so graphql-ws never opens real connections in tests.
// Without this, graphql-ws retry timers keep the worker process alive,
// which prevents @vitest/coverage-v8 from flushing coverage data.
// Code 4400 (BadRequest) is in graphql-ws v6's fatal no-retry list, so it
// throws instead of scheduling setTimeout-based retries.
globalThis.WebSocket = class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  readyState = 3;
  onclose: ((ev: { code: number; reason: string; wasClean: boolean }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: unknown) => void) | null = null;

  constructor() {
    Promise.resolve().then(() => {
      this.onclose?.({ code: 4400, reason: "test mock - no server", wasClean: false });
    });
  }

  close() {}
  send() {}
  addEventListener() {}
  removeEventListener() {}
} as unknown as typeof WebSocket;
