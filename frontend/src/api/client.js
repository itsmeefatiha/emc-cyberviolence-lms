import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Injecter le token d'accès à chaque requête
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Rafraîchir le token automatiquement en cas de 401 Unauthorized
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const status = error.response?.status

    if (status === 401 && !originalRequest._retry && !originalRequest.skipAuthRefresh) {
      originalRequest._retry = true
      const refreshToken = localStorage.getItem('refreshToken')

      if (refreshToken) {
        try {
          // Appel direct à l'endpoint Djoser de rafraîchissement
          const { data } = await axios.post(`${API_BASE_URL}/auth/jwt/refresh/`, {
            refresh: refreshToken,
          })

          localStorage.setItem('accessToken', data.access)
          originalRequest.headers.Authorization = `Bearer ${data.access}`
          return client(originalRequest)
        } catch (refreshError) {
          // Si le refresh token est expiré, déconnexion
          localStorage.clear()
          window.location.href = '/login'
          return Promise.reject(refreshError)
        }
      }
    }

    return Promise.reject(error)
  }
)

export default client