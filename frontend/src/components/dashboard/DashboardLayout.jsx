import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { useAuth } from '../../context/AuthContext.jsx'
import { getSidebarLayout } from '../../utils/sidebar.js'

export default function DashboardLayout() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const { user } = useAuth()
  const layout = getSidebarLayout(user?.role)

  return (
    <div className="min-h-screen bg-[var(--color-page)] font-sans text-slate-900">
      <Sidebar isCollapsed={isCollapsed} onToggle={() => setIsCollapsed(!isCollapsed)} />

      <div
        className={`transition-all duration-300 ease-in-out ${
          isCollapsed ? 'pl-20' : layout.content
        }`}
      >
        <Topbar />
        <main className="relative isolate min-h-[calc(100vh-4rem)] overflow-hidden p-6 sm:p-8">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(36,52,145,0.12),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(56,189,248,0.14),transparent_50%),linear-gradient(180deg,var(--color-page)_0%,#F3F5FB_100%)]" />
            <div
              className="absolute inset-0 opacity-[0.35]"
              style={{
                backgroundImage:
                  'radial-gradient(rgba(36,52,145,0.07) 1px, transparent 1px)',
                backgroundSize: '22px 22px',
              }}
            />
          </div>
          <div className="relative">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
