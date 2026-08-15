import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import {
  Loader2,
  MessageCircle,
  Search,
  Send,
  UserRound,
  AlertCircle,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import {
  listChatContacts,
  listConversations,
  listMessages,
  sendMessage,
  startConversation,
} from '../api/chat.js'
import { getHomePath } from '../utils/navigation.js'

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ChatPage() {
  const { user } = useAuth()
  const location = useLocation()
  const role = user?.role || 'APPRENANT'
  const isLearner = role === 'APPRENANT'
  const initialConversationId = location.state?.conversationId || null

  const [contacts, setContacts] = useState([])
  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState(initialConversationId)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)

  const loadInbox = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [convData, contactData] = await Promise.all([
        listConversations(),
        listChatContacts().catch(() => []),
      ])
      const convs = Array.isArray(convData) ? convData : convData?.results || []
      setConversations(convs)
      setContacts(Array.isArray(contactData) ? contactData : [])
      setActiveId((current) => {
        if (current && convs.some((c) => c.id === current)) return current
        if (initialConversationId && convs.some((c) => c.id === initialConversationId)) {
          return initialConversationId
        }
        return convs[0]?.id || null
      })
    } catch (err) {
      setError(err?.response?.data?.detail || 'Impossible de charger la messagerie.')
    } finally {
      setLoading(false)
    }
  }, [initialConversationId])

  useEffect(() => {
    if (role === 'ADMIN') return
    loadInbox()
  }, [loadInbox, role])

  useEffect(() => {
    if (location.state?.conversationId) {
      setActiveId(location.state.conversationId)
    }
  }, [location.state?.conversationId])

  const loadThread = useCallback(async (conversationId) => {
    if (!conversationId) return
    setLoadingMessages(true)
    try {
      const data = await listMessages(conversationId)
      setMessages(Array.isArray(data) ? data : [])
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c))
      )
    } catch (err) {
      setError(err?.response?.data?.detail || 'Impossible de charger les messages.')
    } finally {
      setLoadingMessages(false)
    }
  }, [])

  useEffect(() => {
    if (role === 'ADMIN') return
    if (activeId) loadThread(activeId)
  }, [activeId, loadThread, role])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Poll lightly for new messages
  useEffect(() => {
    if (role === 'ADMIN' || !activeId) return undefined
    const id = setInterval(() => {
      listMessages(activeId)
        .then((data) => setMessages(Array.isArray(data) ? data : []))
        .catch(() => {})
      listConversations()
        .then((data) => setConversations(Array.isArray(data) ? data : data?.results || []))
        .catch(() => {})
    }, 8000)
    return () => clearInterval(id)
  }, [activeId, role])

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) || null,
    [conversations, activeId]
  )

  const filteredContacts = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return contacts
    return contacts.filter((c) => {
      const hay = `${c.nom || ''} ${c.email || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [contacts, query])

  const filteredConversations = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter((c) => {
      const hay = `${c.peer_nom || ''} ${c.last_message?.body || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [conversations, query])

  if (role === 'ADMIN') {
    return <Navigate to={getHomePath(role)} replace />
  }

  const openContact = async (contact) => {
    setError('')
    try {
      const payload = isLearner
        ? { formateur_id: contact.id }
        : { apprenant_id: contact.id }
      const conv = await startConversation(payload)
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === conv.id)
        return exists ? prev.map((c) => (c.id === conv.id ? conv : c)) : [conv, ...prev]
      })
      setActiveId(conv.id)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Impossible d’ouvrir la conversation.')
    }
  }

  const handleSend = async (event) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text || !activeId || sending) return
    setSending(true)
    setError('')
    try {
      const msg = await sendMessage(activeId, text)
      setMessages((prev) => [...prev, msg])
      setDraft('')
      setConversations((prev) => {
        const updated = prev.map((c) =>
          c.id === activeId
            ? {
                ...c,
                last_message: {
                  id: msg.id,
                  body: msg.body,
                  sender_id: msg.sender,
                  created_at: msg.created_at,
                },
                updated_at: msg.created_at,
              }
            : c
        )
        return updated.sort(
          (a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0)
        )
      })
    } catch (err) {
      setError(err?.response?.data?.detail || 'Envoi impossible.')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-[520px] flex-col gap-4">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Messagerie</h1>
        <p className="mt-1 text-sm text-slate-500">
          {isLearner
            ? 'Échangez directement avec vos formateurs.'
            : 'Répondez aux messages de vos apprenants.'}
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="mr-2 inline h-4 w-4" />
          {error}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200/80 bg-white lg:grid-cols-[320px_1fr]">
        {/* Sidebar inbox */}
        <aside className="flex min-h-0 flex-col border-b border-slate-100 lg:border-b-0 lg:border-r">
          <div className="border-b border-slate-100 p-3">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isLearner ? 'Rechercher un formateur…' : 'Rechercher un apprenant…'}
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <p className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Conversations
            </p>
            {filteredConversations.length === 0 ? (
              <p className="px-3 py-4 text-xs text-slate-400">Aucune conversation.</p>
            ) : (
              <ul className="space-y-1">
                {filteredConversations.map((conv) => {
                  const active = conv.id === activeId
                  return (
                    <li key={conv.id}>
                      <button
                        type="button"
                        onClick={() => setActiveId(conv.id)}
                        className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                          active ? 'bg-brand-light text-brand' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                          <UserRound className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-bold text-slate-800">
                              {conv.peer_nom || 'Contact'}
                            </p>
                            {conv.unread_count > 0 ? (
                              <span className="rounded-full bg-[#243491] px-1.5 py-0.5 text-[10px] font-bold text-white">
                                {conv.unread_count}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {conv.last_message?.body || 'Aucun message'}
                          </p>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            <p className="mt-4 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              {isLearner ? 'Formateurs' : 'Apprenants'}
            </p>
            {filteredContacts.length === 0 ? (
              <p className="px-3 py-4 text-xs text-slate-400">
                {isLearner
                  ? 'Aucun formateur disponible. Inscrivez-vous à un parcours.'
                  : 'Aucun apprenant inscrit pour le moment.'}
              </p>
            ) : (
              <ul className="space-y-1 pb-3">
                {filteredContacts.map((contact) => (
                  <li key={contact.id}>
                    <button
                      type="button"
                      onClick={() => openContact(contact)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-50"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#243491]/10 text-brand">
                        <MessageCircle className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {contact.nom || contact.email}
                        </p>
                        <p className="truncate text-[11px] text-slate-400">
                          {contact.specialite || contact.email}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Thread */}
        <section className="flex min-h-0 flex-col">
          {activeConversation ? (
            <>
              <header className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light text-brand">
                  <UserRound className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {activeConversation.peer_nom || 'Conversation'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {activeConversation.peer_role === 'FORMATEUR' ? 'Formateur' : 'Apprenant'}
                  </p>
                </div>
              </header>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50/60 px-4 py-4 sm:px-6">
                {loadingMessages ? (
                  <div className="flex justify-center py-10 text-slate-400">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="py-10 text-center text-sm text-slate-400">
                    Envoyez le premier message.
                  </p>
                ) : (
                  messages.map((msg) => {
                    const mine = msg.is_mine
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
                            mine
                              ? 'rounded-br-md bg-[#243491] text-white'
                              : 'rounded-bl-md border border-slate-200 bg-white text-slate-800'
                          }`}
                        >
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.body}</p>
                          <p
                            className={`mt-1 text-[10px] ${
                              mine ? 'text-white/70' : 'text-slate-400'
                            }`}
                          >
                            {formatTime(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={bottomRef} />
              </div>

              <form
                onSubmit={handleSend}
                className="flex items-end gap-2 border-t border-slate-100 bg-white p-3 sm:p-4"
              >
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={2}
                  placeholder="Écrire un message…"
                  className="min-h-[44px] max-h-32 flex-1 resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend(e)
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#243491] text-white hover:bg-[#1b276e] disabled:opacity-50"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-slate-400">
              <MessageCircle className="h-10 w-10 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">Sélectionnez un contact</p>
              <p className="max-w-sm text-xs">
                {isLearner
                  ? 'Choisissez un formateur pour démarrer une conversation.'
                  : 'Choisissez un apprenant pour lui répondre.'}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
