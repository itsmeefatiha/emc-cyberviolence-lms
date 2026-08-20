import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppRoutes } from '../App.jsx'
import { AlertProvider } from '../context/AlertContext.jsx'
import { AuthProvider } from '../context/AuthContext.jsx'
import { setCurrentUser } from './msw/db.js'

export function authenticateAs(user) {
  setCurrentUser(user)
  localStorage.setItem('accessToken', 'access-token')
  localStorage.setItem('refreshToken', 'refresh-token')
}

export function renderApp({ route = '/login' } = {}) {
  const user = userEvent.setup()
  const view = render(
    <MemoryRouter initialEntries={[route]}>
      <AlertProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </AlertProvider>
    </MemoryRouter>,
  )
  return { user, ...view }
}
