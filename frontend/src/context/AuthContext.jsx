/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { getCurrentUser, loginUser, logoutUser, registerUser } from '../api/auth.js'

const AuthContext = createContext(null)

const getStoredTokens = () => ({
  accessToken: localStorage.getItem('accessToken'),
  refreshToken: localStorage.getItem('refreshToken'),
})

const getFriendlyAuthError = (error, fallbackMessage) =>
  error?.response?.data?.detail ||
  error?.response?.data?.non_field_errors?.[0] ||
  error?.response?.data?.email?.[0] ||
  error?.response?.data?.password?.[0] ||
  error?.message ||
  fallbackMessage

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [accessToken, setAccessToken] = useState(localStorage.getItem('accessToken'))
  const [storedRefreshToken, setStoredRefreshToken] = useState(localStorage.getItem('refreshToken'))
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('accessToken') && localStorage.getItem('refreshToken')))
  const [error, setError] = useState(null)

  const persistSession = useCallback(({ access, refresh, user: nextUser }) => {
    if (access) {
      localStorage.setItem('accessToken', access)
      setAccessToken(access)
    }

    if (refresh) {
      localStorage.setItem('refreshToken', refresh)
      setStoredRefreshToken(refresh)
    }

    if (nextUser) {
      localStorage.setItem('user', JSON.stringify(nextUser))
      setUser(nextUser)
    }
  }, [])

  const clearSession = useCallback(() => {
    logoutUser()
    setUser(null)
    setAccessToken(null)
    setStoredRefreshToken(null)
  }, [])

  const bootstrapSession = useCallback(async () => {
    const { accessToken: savedAccessToken, refreshToken: savedRefreshToken } = getStoredTokens()

    if (!savedAccessToken || !savedRefreshToken) {
      setLoading(false)
      return
    }

    try {
      // client.js gère automatiquement le rafraîchissement si l'access token est expiré
      const profile = await getCurrentUser()
      const currentAccess = localStorage.getItem('accessToken')
      const currentRefresh = localStorage.getItem('refreshToken')
      persistSession({ access: currentAccess, refresh: currentRefresh, user: profile })
    } catch (bootstrapError) {
      clearSession()
      setError(
        getFriendlyAuthError(bootstrapError, 'Session expirée. Veuillez vous reconnecter.'),
      )
    } finally {
      setLoading(false)
    }
  }, [clearSession, persistSession])

  useEffect(() => {
    queueMicrotask(() => {
      void bootstrapSession()
    })
  }, [bootstrapSession])

  const login = useCallback(
    async (credentials) => {
      setLoading(true)
      setError(null)

      try {
        const response = await loginUser(credentials)
        const nextAccessToken = response.access
        const nextRefreshToken = response.refresh

        if (!nextAccessToken || !nextRefreshToken) {
          throw new Error('Authentication response is incomplete')
        }

        persistSession({ access: nextAccessToken, refresh: nextRefreshToken })

        const profile = response.user ?? (await getCurrentUser())
        persistSession({ user: profile })

        return { user: profile, access: nextAccessToken, refresh: nextRefreshToken }
      } catch (loginError) {
        clearSession()
        setError(getFriendlyAuthError(loginError, 'Impossible de se connecter.'))
        throw loginError
      } finally {
        setLoading(false)
      }
    },
    [clearSession, persistSession],
  )

  const register = useCallback(
    async (userData) => {
      setLoading(true)
      setError(null)

      try {
        const response = await registerUser(userData)

        if (response?.access && response?.refresh) {
          const profile = response.user ?? (await getCurrentUser())
          persistSession({ access: response.access, refresh: response.refresh, user: profile })
          return { authenticated: true, user: profile }
        }

        return { authenticated: false, user: response?.user ?? response }
      } catch (registerError) {
        setError(getFriendlyAuthError(registerError, 'Impossible de créer le compte.'))
        throw registerError
      } finally {
        setLoading(false)
      }
    },
    [persistSession],
  )

  const logout = useCallback(() => {
    clearSession()
    setError(null)
  }, [clearSession])

  const value = {
    user,
    accessToken,
    refreshToken: storedRefreshToken,
    isAuthenticated: Boolean(user && accessToken),
    loading,
    error,
    setError,
    login,
    register,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}