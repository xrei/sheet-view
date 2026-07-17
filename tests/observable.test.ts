import {describe, expect, it, vi} from 'vitest'

import {createStore} from '../src/core/observable'

describe('createStore', () => {
  it('getSnapshot returns the initial snapshot', () => {
    const initial: number[] = []
    const store = createStore(initial)
    expect(store.getSnapshot()).toBe(initial)
  })

  it('setSnapshot with a new reference updates getSnapshot and notifies', () => {
    const store = createStore<Array<{id: number}>>([])
    const listener = vi.fn()
    store.subscribe(listener)

    const next = [{id: 1}]
    store.setSnapshot(next)

    expect(store.getSnapshot()).toBe(next)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('setSnapshot with the same reference does not notify (no redundant render)', () => {
    const same = [{id: 1}]
    const store = createStore(same)
    const listener = vi.fn()
    store.subscribe(listener)

    store.setSnapshot(same)

    expect(listener).not.toHaveBeenCalled()
    expect(store.getSnapshot()).toBe(same)
  })

  it('getSnapshot stays referentially stable between unrelated reads', () => {
    const store = createStore<number[]>([])
    const a = store.getSnapshot()
    const b = store.getSnapshot()
    expect(a).toBe(b)

    const next = [1]
    store.setSnapshot(next)
    expect(store.getSnapshot()).toBe(next)
    expect(store.getSnapshot()).not.toBe(a)
  })

  it('unsubscribe stops further notifications', () => {
    const store = createStore<number[]>([])
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)

    store.setSnapshot([1])
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    store.setSnapshot([2])
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('notifies every subscriber', () => {
    const store = createStore<number[]>([])
    const a = vi.fn()
    const b = vi.fn()
    store.subscribe(a)
    store.subscribe(b)

    store.setSnapshot([1])

    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
  })
})
