import Storage from 'expo-sqlite/kv-store';

/** iOS + Android: SQLite-backed key-value store (survives app updates). */
export const kv = {
  getItem: (key: string) => Storage.getItem(key),
  setItem: (key: string, value: string) => Storage.setItem(key, value),
};
