import { Link, useLocation } from 'react-router-dom'
import {
  Award,
  BarChart3,
  BookOpen,
  Compass,
  Users,
  Home,
  Video,
  ShieldCheck,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import IconImage from '../../assets/graduation-cap.png'
import { getSidebarLayout } from '../../utils/sidebar.js'

const NAV_CONFIG = {
  APPRENANT: [
    { name: 'Tableau de bord', icon: Home, path: '/dashboard' },
    { name: 'Mes formations', icon: BookOpen, path: '/my-courses' },
    { name: 'Sessions live', icon: Video, path: '/live-sessions' },
    { name: 'Certificats', icon: Award, path: '/certificates' },
    { name: 'Explorer', icon: Compass, path: '/browse' },
  ],
  FORMATEUR: [
    { name: 'Tableau de bord', icon: Home, path: '/instructor/dashboard' },
    { name: 'Constructeur de parcours', icon: BookOpen, path: '/instructor/courses' },
    { name: 'Sessions live', icon: Video, path: '/instructor/live-sessions' },
    { name: 'Suivi des apprenants', icon: BarChart3, path: '/instructor/analytics' },
  ],
  ADMIN: [
    { name: 'Tableau de bord', icon: Home, path: '/admin/dashboard' },
    { name: 'Modération des parcours', icon: ShieldCheck, path: '/admin/courses' },
    { name: 'Gestion des utilisateurs', icon: Users, path: '/admin/users' },
  ],
}

export default function Sidebar({ isCollapsed, onToggle }) {
  const location = useLocation()
  const { user } = useAuth()
  const userRole = user?.role || 'APPRENANT'
  const navItems = NAV_CONFIG[userRole] || NAV_CONFIG.APPRENANT
  const layout = getSidebarLayout(userRole)

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 flex flex-col border-r border-slate-200/80 bg-white py-6 transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-20 px-3' : `${layout.aside} px-5`
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        title={isCollapsed ? 'Agrandir la barre' : 'Réduire la barre'}
        className={`flex items-center gap-2.5 rounded-xl text-left transition hover:bg-slate-50 ${
          isCollapsed ? 'mx-auto justify-center px-2 py-2' : 'w-full px-2 py-2'
        }`}
      >
        <img
          src={IconImage}
          alt="EMC Logo"
          className="h-6 w-6 shrink-0 object-contain"
        />
        {!isCollapsed && (
          <span className="whitespace-nowrap text-lg font-extrabold tracking-tight text-[#243491]">
            EMC E-Formation
          </span>
        )}
      </button>

      <nav className="mt-6 space-y-1.5">
        {navItems.map((item) => {
          const isHomePath = [
            '/dashboard',
            '/instructor/dashboard',
            '/admin/dashboard',
          ].includes(item.path)
          const isActive =
            location.pathname === item.path ||
            (!isHomePath && location.pathname.startsWith(item.path))
          const Icon = item.icon

          return (
            <Link
              key={item.name}
              to={item.path}
              title={isCollapsed ? item.name : undefined}
              className={`group relative flex items-center gap-3 rounded-xl py-3 text-sm font-semibold transition-all ${
                isCollapsed ? 'justify-center px-0' : 'px-3'
              } ${
                isActive
                  ? 'bg-brand-light text-brand'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon
                className={`h-5 w-5 shrink-0 ${
                  isActive ? 'text-brand' : 'text-slate-400 group-hover:text-slate-600'
                }`}
              />
              {!isCollapsed && (
                <span className="leading-snug">{item.name}</span>
              )}
              {isActive && (
                <span className="absolute right-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-l-full bg-brand" />
              )}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
