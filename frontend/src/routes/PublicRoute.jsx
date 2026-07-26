import { Navigate, Outlet } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

export default function PublicRoute() {
  const { isAuthenticated, loading } = useAuth()
  const hasStoredSession = Boolean(localStorage.getItem('accessToken') && localStorage.getItem('refreshToken'))

  if (loading && hasStoredSession) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-100 font-sans text-slate-800">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-[#243491]" />
        </div>
      </div>
    )
  }

  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Outlet />
}