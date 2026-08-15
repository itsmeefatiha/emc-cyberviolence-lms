import { vi } from 'vitest'

export const mockAuth = {
  user: {
    id: 1,
    first_name: 'Amina',
    last_name: 'Benali',
    username: 'amina',
    email: 'amina@example.com',
    role: 'APPRENANT',
  },
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  isAuthenticated: true,
  loading: false,
  error: null,
  setError: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  refreshUser: vi.fn(),
}

export function resetMockAuth(overrides = {}) {
  mockAuth.user = {
    id: 1,
    first_name: 'Amina',
    last_name: 'Benali',
    username: 'amina',
    email: 'amina@example.com',
    role: 'APPRENANT',
  }
  mockAuth.accessToken = 'access-token'
  mockAuth.refreshToken = 'refresh-token'
  mockAuth.isAuthenticated = true
  mockAuth.loading = false
  mockAuth.error = null
  mockAuth.setError = vi.fn()
  mockAuth.login = vi.fn()
  mockAuth.register = vi.fn()
  mockAuth.logout = vi.fn()
  mockAuth.refreshUser = vi.fn()
  Object.assign(mockAuth, overrides)
}

export function useAuth() {
  return mockAuth
}

export function AuthProvider({ children }) {
  return children
}
