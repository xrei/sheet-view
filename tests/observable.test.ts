import {describe, expect, it, vi} from 'vitest'

import {createStore} from '../src/core/observable'

describe('createStore', () => {
  it('setSnapshot with a new reference updates getSnapshot and notifies', () => {
    const store = createStore<Array<{id: number}>>([])
    const listener = vi.fn()
    store.subscribe(listener)

    const next = [{id: 1}]
    store.setSnapshot(next)

    expect(store.getSnapshot()).toBe(next)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('setSnapshot with the same reference does not notify', () => {
    const same = [{id: 1}]
    const store = createStore(same)
    const listener = vi.fn()
    store.subscribe(listener)

    store.setSnapshot(same)

    expect(listener).not.toHaveBeenCalled()
    expect(store.getSnapshot()).toBe(same)
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
})
