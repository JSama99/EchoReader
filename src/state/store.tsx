import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';

import { kv as platformKv } from './kv';
import { initialState, migrate, reduce, type Action, type ReaderState } from './model';

const KEY = 'echoreader.state.v1';

export type KV = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export type Store = {
  getState(): ReaderState;
  dispatch(action: Action): void;
  subscribe(listener: () => void): () => void;
  hydrate(): Promise<void>;
  ready(): boolean;
};

/** Store with write-through persistence. Writes are coalesced per tick. */
export function createStore(kv: KV): Store {
  let state = initialState;
  let hydrated = false;
  let pending: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<() => void>();

  const emit = () => listeners.forEach((l) => l());
  const persist = () => {
    if (pending) return;
    pending = setTimeout(() => {
      pending = null;
      kv.setItem(KEY, JSON.stringify(state)).catch(() => {});
    }, 0);
  };

  return {
    getState: () => state,
    ready: () => hydrated,
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    dispatch(action) {
      const next = reduce(state, action);
      if (next === state) return;
      state = next;
      if (hydrated) persist();
      emit();
    },
    async hydrate() {
      try {
        const raw = await kv.getItem(KEY);
        if (raw) state = migrate(JSON.parse(raw));
      } catch {
        state = initialState;
      }
      hydrated = true;
      emit();
    },
  };
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children, kv = platformKv }: { children: ReactNode; kv?: KV }) {
  const [store] = useState(() => createStore(kv));
  useEffect(() => {
    void store.hydrate();
  }, [store]);
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}

export function useReader<T>(select: (s: ReaderState) => T): T {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, () => select(store.getState()), () => select(store.getState()));
}

export function useDispatch() {
  return useStore().dispatch;
}

export function useHydrated(): boolean {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, store.ready, store.ready);
}
