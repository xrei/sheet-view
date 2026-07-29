import {afterEach} from 'vitest'
import {cleanup} from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

import {installDialogShim} from '../src/testing'

// jsdom ships HTMLDialogElement without showModal/show/close, and the core opens
// sheets via showModal(). We consume the SHIPPED shim (from src, so the suite
// still needs no build) rather than a private copy — a regression in what we
// publish then breaks these tests immediately.
//
// Escape→`cancel` is deliberately left off: tests dispatch `cancel` on the dialog
// directly, which is the honest simulation of what the UA does.
installDialogShim()

afterEach(() => {
  cleanup()
})
