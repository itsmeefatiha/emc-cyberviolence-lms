import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
    </div>
  )
}

export default function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return <Spinner />
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />
}