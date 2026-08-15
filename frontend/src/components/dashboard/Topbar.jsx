import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bell,
  BookOpen,
  CheckCheck,
  LogOut,
  MessageCircle,
  Search,
  Shield,
  SlidersHorizontal,
  UserCircle2,
  UserPlus,
  Video,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import {
  getUnreadNotificationsCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../api/notifications.js'
import { listConversations } from '../../api/chat.js'
import { resolveBackendUrl } from '../../utils/courseHelpers.js'

const formatRelative = (value) => {
  if (!value) return ''
  const date = new Date(value)
  const diff = (Date.now() - date.getTime()) / 1000
  if (diff < 60) return "À l'instant"
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

const notifIcon = (type) => {
  switch (type) {
    case 'INSCRIPTION':
      return UserPlus
    case 'MESSAGE':
      return MessageCircle
    case 'SESSION_LIVE':
    case 'SESSION_RAPPEL':
      return Video
    case 'PARCOURS_CREE':
      return Shield
    default:
      return BookOpen
  }
}

export default function Topbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const displayName = user?.first_name || user?.username || user?.email || 'Utilisateur'
  const photoUrl = user?.photo ? resolveBackendUrl(user.photo) : ''
  const canChat = user?.role === 'APPRENANT' || user?.role === 'FORMATEUR'

  const [notifOpen, setNotifOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadNotifs, setUnreadNotifs] = useState(0)
  const [conversations, setConversations] = useState([])
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [loadingNotifs, setLoadingNotifs] = useState(false)
  const [loadingChat, setLoadingChat] = useState(false)
  const panelRef = useRef(null)

  const refreshNotifications = useCallback(async () => {
    try {
      const [list, countData] = await Promise.all([
        listNotifications(),
        getUnreadNotificationsCount(),
      ])
      const items = Array.isArray(list) ? list : list?.results || []
      setNotifications(items.slice(0, 20))
      setUnreadNotifs(countData?.count || 0)
    } catch {
      /* ignore */
    }
  }, [])

  const refreshChat = useCallback(async () => {
    if (!canChat) return
    try {
      const list = await listConversations()
      const items = Array.isArray(list) ? list : list?.results || []
      setConversations(items.slice(0, 12))
      setUnreadMessages(
        items.reduce((sum, conv) => sum + (Number(conv.unread_count) || 0), 0)
      )
    } catch {
      /* ignore */
    }
  }, [canChat])

  useEffect(() => {
    refreshNotifications()
    refreshChat()
    const interval = setInterval(() => {
      refreshNotifications()
      refreshChat()
    }, 15000)
    const onFocus = () => {
      refreshNotifications()
      refreshChat()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [refreshNotifications, refreshChat])

  useEffect(() => {
    const onClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setNotifOpen(false)
        setChatOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const handleOpenNotifs = async () => {
    setChatOpen(false)
    setNotifOpen((prev) => !prev)
    if (!notifOpen) {
      setLoadingNotifs(true)
      await refreshNotifications()
      setLoadingNotifs(false)
    }
  }

  const handleOpenChat = async () => {
    setNotifOpen(false)
    setChatOpen((prev) => !prev)
    if (!chatOpen) {
      setLoadingChat(true)
      await refreshChat()
      setLoadingChat(false)
    }
  }

  const handleClickNotif = async (notif) => {
    if (!notif.est_lue) {
      try {
        await markNotificationRead(notif.id)
        setUnreadNotifs((c) => Math.max(0, c - 1))
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, est_lue: true } : n))
        )
      } catch {
        /* ignore */
      }
    }
    setNotifOpen(false)
    if (notif.lien) navigate(notif.lien)
  }

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsRead()
      setUnreadNotifs(0)
      setNotifications((prev) => prev.map((n) => ({ ...n, est_lue: true })))
    } catch {
      /* ignore */
    }
  }

  const openConversation = (conversationId) => {
    setChatOpen(false)
    navigate('/chat', { state: conversationId ? { conversationId } : undefined })
  }

  return (
    <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/80 px-8 backdrop-blur-md">
      <div className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Rechercher un parcours ou un formateur"
          className="w-full rounded-full border border-slate-200/80 bg-slate-50/80 py-2.5 pl-11 pr-10 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-brand focus:bg-white focus:ring-1 focus:ring-brand"
        />
        <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-3" ref={panelRef}>
        {canChat && (
          <div className="relative">
            <button
              type="button"
              onClick={handleOpenChat}
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/80 bg-slate-50 text-slate-600 transition hover:bg-slate-100"
              aria-label="Ouvrir les messages"
              title="Messages"
            >
              <MessageCircle className="h-4 w-4" />
              {unreadMessages > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </button>

            {chatOpen && (
              <div className="absolute right-0 mt-2 w-96 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <p className="text-sm font-bold text-slate-900">Messages</p>
                  <button
                    type="button"
                    onClick={() => openConversation()}
                    className="text-[11px] font-bold text-[#243491] hover:underline"
                  >
                    Ouvrir le chat
                  </button>
                </div>

                <div className="max-h-80 overflow-y-auto">
                  {loadingChat ? (
                    <p className="p-4 text-center text-xs text-slate-400">Chargement…</p>
                  ) : conversations.length === 0 ? (
                    <p className="p-6 text-center text-xs text-slate-400">
                      Aucune conversation pour le moment.
                    </p>
                  ) : (
                    conversations.map((conv) => {
                      const unread = Number(conv.unread_count) || 0
                      const preview = conv.last_message?.body || 'Aucun message'
                      return (
                        <button
                          key={conv.id}
                          type="button"
                          onClick={() => openConversation(conv.id)}
                          className={`flex w-full gap-3 border-b border-slate-50 px-4 py-3 text-left transition hover:bg-slate-50 ${
                            unread > 0 ? 'bg-indigo-50/40' : ''
                          }`}
                        >
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#243491]/10 text-[#243491]">
                            <MessageCircle className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-900">
                              {conv.peer_nom || 'Conversation'}
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">
                              {preview}
                            </p>
                            <p className="mt-1 text-[10px] font-medium text-slate-400">
                              {formatRelative(
                                conv.last_message?.created_at || conv.updated_at
                              )}
                            </p>
                          </div>
                          {unread > 0 && (
                            <span className="mt-1 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#243491] px-1.5 text-[10px] font-bold text-white">
                              {unread > 9 ? '9+' : unread}
                            </span>
                          )}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="relative">
          <button
            type="button"
            onClick={handleOpenNotifs}
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/80 bg-slate-50 text-slate-600 transition hover:bg-slate-100"
            aria-label="Ouvrir les notifications"
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadNotifs > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unreadNotifs > 9 ? '9+' : unreadNotifs}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-96 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <p className="text-sm font-bold text-slate-900">Notifications</p>
                {unreadNotifs > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAll}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#243491] hover:underline"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Tout marquer lu
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto">
                {loadingNotifs ? (
                  <p className="p-4 text-center text-xs text-slate-400">Chargement…</p>
                ) : notifications.length === 0 ? (
                  <p className="p-6 text-center text-xs text-slate-400">
                    Aucune notification pour le moment.
                  </p>
                ) : (
                  notifications.map((notif) => {
                    const Icon = notifIcon(notif.type_notification)
                    return (
                      <button
                        key={notif.id}
                        type="button"
                        onClick={() => handleClickNotif(notif)}
                        className={`flex w-full gap-3 border-b border-slate-50 px-4 py-3 text-left transition hover:bg-slate-50 ${
                          !notif.est_lue ? 'bg-indigo-50/40' : ''
                        }`}
                      >
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#243491]/10 text-[#243491]">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-900">{notif.titre}</p>
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">
                            {notif.message}
                          </p>
                          <p className="mt-1 text-[10px] font-medium text-slate-400">
                            {formatRelative(notif.date_creation)}
                          </p>
                        </div>
                        {!notif.est_lue && (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#243491]" />
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <div className="ml-1 flex items-center gap-3 border-l border-slate-200 pl-4">
          <Link
            to="/profile"
            className="group flex items-center gap-2.5 rounded-xl p-1 transition hover:bg-slate-50"
            title="Voir mon profil"
          >
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={displayName}
                className="h-10 w-10 rounded-full object-cover ring-2 ring-slate-100"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 font-bold text-[#243491] transition group-hover:bg-[#243491] group-hover:text-white">
                <UserCircle2 className="h-6 w-6" />
              </div>
            )}
            <div className="hidden text-left md:block">
              <p className="text-sm font-bold text-slate-900 transition group-hover:text-[#243491]">
                {displayName}
              </p>
              <p className="text-xs font-medium text-slate-400">
                {user?.role || user?.profil_professionnel || 'Apprenant'}
              </p>
            </div>
          </Link>

          <button
            onClick={logout}
            title="Déconnexion"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
