import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { resetDb } from './test/msw/db.js'
import { server } from './test/msw/server.js'

vi.mock('react-chartjs-2', async () => {
  const { createElement } = await import('react')
  return {
    Line: () => createElement('div', { 'data-testid': 'chart-line' }),
    Bar: () => createElement('div', { 'data-testid': 'chart-bar' }),
    Doughnut: () => createElement('div', { 'data-testid': 'chart-doughnut' }),
  }
})

vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  CategoryScale: {},
  LinearScale: {},
  PointElement: {},
  LineElement: {},
  BarElement: {},
  ArcElement: {},
  Tooltip: {},
  Legend: {},
  Filler: {},
}))

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'bypass' })
})

afterEach(() => {
  server.resetHandlers()
  resetDb()
  cleanup()
  vi.useRealTimers()
  localStorage.clear()
  sessionStorage.clear()
})

afterAll(() => {
  server.close()
})

Element.prototype.scrollIntoView = vi.fn()

if (!URL.createObjectURL) {
  URL.createObjectURL = vi.fn(() => 'blob:mock-document')
}
if (!URL.revokeObjectURL) {
  URL.revokeObjectURL = vi.fn()
}

Object.defineProperty(HTMLMediaElement.prototype, 'play', {
  configurable: true,
  writable: true,
  value: vi.fn(() => Promise.resolve()),
})
Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
  configurable: true,
  writable: true,
  value: vi.fn(),
})
Object.defineProperty(HTMLMediaElement.prototype, 'load', {
  configurable: true,
  writable: true,
  value: vi.fn(),
})

if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

if (!navigator.mediaDevices) {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: vi.fn(async () => ({
        getTracks: () => [],
        getAudioTracks: () => [],
        getVideoTracks: () => [],
      })),
    },
  })
}
