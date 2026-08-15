import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

export function renderWithRouter(ui, { route = '/', path, ...options } = {}) {
  const user = userEvent.setup()
  const content = path ? (
    <Routes>
      <Route path={path} element={ui} />
    </Routes>
  ) : (
    ui
  )

  return {
    user,
    ...render(
      <MemoryRouter initialEntries={[route]}>{content}</MemoryRouter>,
      options,
    ),
  }
}

export function renderWithRoutes(ui, { route = '/' } = {}) {
  const user = userEvent.setup()

  return {
    user,
    ...render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>),
  }
}
