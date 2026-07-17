export interface Store<T> {
  getSnapshot: () => T
  subscribe: (listener: () => void) => () => void
  setSnapshot: (next: T) => void
}

export function createStore<T>(initialSnapshot: T): Store<T> {
  let snapshot = initialSnapshot
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    setSnapshot(next: T): void {
      if (next === snapshot) return
      snapshot = next
      for (const listener of listeners) listener()
    },
  }
}
