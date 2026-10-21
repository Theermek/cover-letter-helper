/**
 * Minimal in-memory stand-in for the chrome.* APIs the UI touches.
 *
 * Enough to render every page in a DOM test and catch the failure mode that is
 * otherwise invisible until you load the extension by hand: a component that
 * throws on mount and leaves a blank popup.
 */

type Listener = (changes: Record<string, { newValue?: unknown }>, area: string) => void;

export interface ChromeStub {
  store: Record<string, unknown>;
  sent: unknown[];
  /** Queue a reply for the next sendMessage call, by message type. */
  replies: Record<string, unknown>;
}

export const installChromeStub = (initial: Record<string, unknown> = {}): ChromeStub => {
  const stub: ChromeStub = { store: { ...initial }, sent: [], replies: {} };
  const listeners: Listener[] = [];

  const chromeApi = {
    storage: {
      local: {
        get: async (key: string | string[] | null) => {
          if (key === null) return { ...stub.store };
          const keys = Array.isArray(key) ? key : [key];
          return Object.fromEntries(
            keys.filter((k) => k in stub.store).map((k) => [k, stub.store[k]]),
          );
        },
        set: async (items: Record<string, unknown>) => {
          const changes: Record<string, { newValue?: unknown }> = {};
          for (const [k, v] of Object.entries(items)) {
            stub.store[k] = v;
            changes[k] = { newValue: v };
          }
          listeners.forEach((l) => l(changes, 'local'));
        },
        remove: async (key: string) => {
          delete stub.store[key];
        },
        clear: async () => {
          stub.store = {};
        },
      },
      onChanged: {
        addListener: (l: Listener) => listeners.push(l),
        removeListener: (l: Listener) => {
          const i = listeners.indexOf(l);
          if (i >= 0) listeners.splice(i, 1);
        },
      },
    },
    runtime: {
      sendMessage: async (message: { type: string }) => {
        stub.sent.push(message);
        const data = stub.replies[message.type] ?? null;
        return { ok: true, data };
      },
      openOptionsPage: async () => undefined,
      getURL: (path: string) => `chrome-extension://test/${path}`,
    },
    tabs: { create: async () => undefined },
    windows: { create: async () => undefined },
    action: { openPopup: async () => undefined },
    contextMenus: {
      create: () => undefined,
      removeAll: (cb?: () => void) => cb?.(),
      onClicked: { addListener: () => undefined },
    },
  };

  (globalThis as { chrome?: unknown }).chrome = chromeApi;
  return stub;
};
