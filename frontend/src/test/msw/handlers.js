import { http, HttpResponse } from 'msw'
import { db, TEST_PASSWORD, USERS } from './db.js'

const api = (path) => `*/api${path}`

const requireAuth = () => {
  if (!db.currentUser) {
    return HttpResponse.json(
      { detail: 'Authentication credentials were not provided.' },
      { status: 401 },
    )
  }
  return null
}

const withEnrollmentFlags = (parcours) => ({
  ...parcours,
  is_enrolled: db.enrolledIds.has(parcours.id),
  is_favorite: db.favoriteIds.has(parcours.id),
})

const learningItem = (parcours, extra = {}) => ({
  parcours_id: parcours.id,
  parcours_titre: parcours.titre,
  image: parcours.image,
  publie_par: parcours.publie_par,
  formateur_nom: parcours.formateur_nom,
  is_enrolled: db.enrolledIds.has(parcours.id),
  is_favorite: db.favoriteIds.has(parcours.id),
  est_termine: false,
  pourcentage: db.enrolledIds.has(parcours.id) ? 35 : 0,
  total_quizzes: 1,
  quizzes_reussis: 0,
  ...extra,
})

export const handlers = [
  http.post(api('/auth/jwt/create/'), async ({ request }) => {
    const { email, password } = await request.json()
    const user = db.users.find((item) => item.email === email)

    if (!user || password !== TEST_PASSWORD) {
      return HttpResponse.json(
        { detail: 'No active account found with the given credentials' },
        { status: 401 },
      )
    }

    db.currentUser = { ...user }
    return HttpResponse.json({
      access: 'access-token',
      refresh: 'refresh-token',
    })
  }),

  http.post(api('/auth/jwt/refresh/'), async ({ request }) => {
    const { refresh } = await request.json()
    if (!refresh) {
      return HttpResponse.json({ detail: 'Token invalide.' }, { status: 401 })
    }
    return HttpResponse.json({ access: 'access-token-refreshed' })
  }),

  http.get(api('/auth/users/me/'), () => {
    const denied = requireAuth()
    if (denied) return denied
    return HttpResponse.json(db.currentUser)
  }),

  http.patch(api('/auth/users/me/'), async ({ request }) => {
    const denied = requireAuth()
    if (denied) return denied
    const body = await request.json()
    Object.assign(db.currentUser, body)
    const index = db.users.findIndex((item) => item.id === db.currentUser.id)
    if (index >= 0) db.users[index] = { ...db.currentUser }
    return HttpResponse.json(db.currentUser)
  }),

  http.get(api('/auth/users/'), () => {
    const denied = requireAuth()
    if (denied) return denied
    return HttpResponse.json(db.users)
  }),

  http.post(api('/auth/users/'), async ({ request }) => {
    const body = await request.json()
    if (db.users.some((item) => item.email === body.email)) {
      return HttpResponse.json(
        { email: ['Un utilisateur avec cet email existe déjà.'] },
        { status: 400 },
      )
    }

    const created = {
      id: `user-${Date.now()}`,
      first_name: body.first_name || '',
      last_name: body.last_name || '',
      username: body.username || body.email?.split('@')[0],
      email: body.email,
      role: body.role || 'APPRENANT',
      telephone: body.telephone || '',
      is_active: body.is_active !== false,
      photo: null,
    }
    db.users.push(created)
    return HttpResponse.json(created, { status: 201 })
  }),

  http.patch(api('/auth/users/:id/'), async ({ params, request }) => {
    const denied = requireAuth()
    if (denied) return denied
    const body = await request.json()
    const index = db.users.findIndex((item) => item.id === params.id)
    if (index < 0) {
      return HttpResponse.json({ detail: 'Introuvable.' }, { status: 404 })
    }
    db.users[index] = { ...db.users[index], ...body }
    return HttpResponse.json(db.users[index])
  }),

  http.delete(api('/auth/users/:id/'), ({ params }) => {
    const denied = requireAuth()
    if (denied) return denied
    db.users = db.users.filter((item) => item.id !== params.id)
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(api('/auth/users/activation/'), async ({ request }) => {
    const { uid, token } = await request.json()
    if (!uid || !token || token === 'expired') {
      return HttpResponse.json({ detail: 'Lien invalide.' }, { status: 400 })
    }
    return HttpResponse.json({})
  }),

  http.post(api('/auth/users/reset_password/'), async () => HttpResponse.json({})),

  http.post(api('/auth/users/reset_password_confirm/'), async ({ request }) => {
    const { uid, token, new_password } = await request.json()
    if (!uid || !token || !new_password) {
      return HttpResponse.json({ detail: 'Lien invalide.' }, { status: 400 })
    }
    return HttpResponse.json({})
  }),

  http.get(api('/v1/courses/parcours/'), () => {
    const denied = requireAuth()
    if (denied) return denied
    return HttpResponse.json(db.parcours.map(withEnrollmentFlags))
  }),

  http.get(api('/v1/courses/parcours/:id/'), ({ params }) => {
    const denied = requireAuth()
    if (denied) return denied
    const parcours = db.parcours.find((item) => item.id === params.id)
    if (!parcours) {
      return HttpResponse.json({ detail: 'Parcours introuvable.' }, { status: 404 })
    }
    return HttpResponse.json(withEnrollmentFlags(parcours))
  }),

  http.post(api('/v1/courses/parcours/'), async ({ request }) => {
    const denied = requireAuth()
    if (denied) return denied
    const contentType = request.headers.get('content-type') || ''
    let titre = 'Nouveau parcours'
    let description
    let profil_cible = 'EDUCATEUR'
    let statut = 'BROUILLON'

    if (contentType.includes('multipart')) {
      const form = await request.formData()
      titre = String(form.get('titre') || titre)
      description = String(form.get('description') || '')
      profil_cible = String(form.get('profil_cible') || profil_cible)
      statut = String(form.get('statut') || statut)
    } else {
      const body = await request.json()
      titre = body.titre || titre
      description = body.description || ''
      profil_cible = body.profil_cible || profil_cible
      statut = body.statut || statut
    }

    const created = {
      id: `parcours-${Date.now()}`,
      titre,
      description,
      profil_cible,
      statut,
      formateur: db.currentUser.id,
      formateur_nom: `${db.currentUser.first_name} ${db.currentUser.last_name}`,
      publie_par: `${db.currentUser.first_name} ${db.currentUser.last_name}`,
      modules: [],
      nombre_modules: 0,
      nombre_lecons: 0,
    }
    db.parcours.unshift(created)
    return HttpResponse.json(created, { status: 201 })
  }),

  http.get(api('/v1/progression/me/summary/'), () => {
    const denied = requireAuth()
    if (denied) return denied
    const enrolled = db.parcours.filter((item) => db.enrolledIds.has(item.id))
    return HttpResponse.json({
      parcours: enrolled.map((item) => learningItem(item)),
      lecons_terminees: enrolled.length ? 1 : 0,
      temps_total_secondes: enrolled.length ? 3600 : 0,
      derniere_activite: enrolled.length
        ? {
            lecon_titre: 'Qu’est-ce que le cyberharcèlement ?',
            parcours_id: enrolled[0].id,
          }
        : null,
    })
  }),

  http.get(api('/v1/progression/me/learning/'), () => {
    const denied = requireAuth()
    if (denied) return denied
    const enrolled = db.parcours.filter((item) => db.enrolledIds.has(item.id)).map((item) => learningItem(item))
    const favorites = db.parcours
      .filter((item) => db.favoriteIds.has(item.id))
      .map((item) => learningItem(item))
    return HttpResponse.json({
      enrolled,
      completed: [],
      favorites,
      favorites_count: favorites.length,
    })
  }),

  http.get(api('/v1/progression/me/activity/'), () => {
    const denied = requireAuth()
    if (denied) return denied
    return HttpResponse.json({
      total_display: '2h 15min',
      days: [
        { label: 'Lun', value_heures: 1.5, display: '1h 30min' },
        { label: 'Mar', value_heures: 0.75, display: '45min' },
      ],
    })
  }),

  http.get(api('/v1/progression/parcours/:id/summary/'), ({ params }) => {
    const denied = requireAuth()
    if (denied) return denied
    const enrolled = db.enrolledIds.has(params.id)
    return HttpResponse.json({
      is_enrolled: enrolled,
      pourcentage: enrolled ? 35 : 0,
      modules: [
        {
          module_id: 'module-1',
          lecons: [
            {
              lecon_id: 'lecon-1',
              statut: enrolled ? 'EN_COURS' : 'NON_COMMENCE',
            },
          ],
        },
      ],
    })
  }),

  http.post(api('/v1/progression/enroll/'), async ({ request }) => {
    const denied = requireAuth()
    if (denied) return denied
    const { parcours_id } = await request.json()
    db.enrolledIds.add(parcours_id)
    return HttpResponse.json({ premiere_lecon_id: 'lecon-1' }, { status: 201 })
  }),

  http.post(api('/v1/progression/favorites/toggle/'), async ({ request }) => {
    const denied = requireAuth()
    if (denied) return denied
    const { parcours_id } = await request.json()
    if (db.favoriteIds.has(parcours_id)) {
      db.favoriteIds.delete(parcours_id)
      return HttpResponse.json({ is_favorite: false })
    }
    db.favoriteIds.add(parcours_id)
    return HttpResponse.json({ is_favorite: true })
  }),

  http.post(api('/v1/progression/track/'), async () => HttpResponse.json({ statut: 'TERMINE' })),

  http.get(api('/v1/progression/dashboard/'), () => {
    const denied = requireAuth()
    if (denied) return denied
    return HttpResponse.json({
      parcours_count: db.parcours.length,
      total_apprenants: 2,
      lecons_terminees: 5,
      taux_reussite_modules: 80,
      parcours: db.parcours.map((item) => ({
        parcours_id: item.id,
        parcours_titre: item.titre,
        apprenants_actifs: 2,
        inscriptions: 2,
        pourcentage_moyen: 42,
      })),
      apprenants: [
        {
          apprenant_id: USERS.learner.id,
          apprenant_nom: 'Amina Benali',
          parcours_inscrits: 1,
          temps_total_secondes: 3600,
          pourcentage: 35,
          profil_professionnel: 'EDUCATEUR',
        },
      ],
    })
  }),

  http.get(api('/v1/quizzes/certificats/'), () => {
    const denied = requireAuth()
    if (denied) return denied
    return HttpResponse.json(db.certificats)
  }),

  http.get(api('/v1/quizzes/certificats/:id/download/'), ({ params }) => {
    const denied = requireAuth()
    if (denied) return denied
    return HttpResponse.json({
      download_url: `/media/certificats/${params.id}.pdf`,
    })
  }),

  http.get(api('/v1/notifications/'), () => {
    const denied = requireAuth()
    if (denied) return denied
    return HttpResponse.json(db.notifications)
  }),

  http.get(api('/v1/notifications/unread-count/'), () => {
    const denied = requireAuth()
    if (denied) return denied
    return HttpResponse.json({
      count: db.notifications.filter((item) => !item.est_lue).length,
    })
  }),

  http.post(api('/v1/notifications/mark-all-read/'), () => {
    const denied = requireAuth()
    if (denied) return denied
    db.notifications = db.notifications.map((item) => ({ ...item, est_lue: true }))
    return HttpResponse.json({})
  }),

  http.post(api('/v1/notifications/:id/mark-read/'), ({ params }) => {
    const denied = requireAuth()
    if (denied) return denied
    db.notifications = db.notifications.map((item) =>
      item.id === params.id ? { ...item, est_lue: true } : item,
    )
    return HttpResponse.json({})
  }),

  http.get(api('/v1/chat/conversations/'), () => {
    const denied = requireAuth()
    if (denied) return denied
    return HttpResponse.json(db.conversations)
  }),

  http.get(api('/v1/chat/contacts/'), () => {
    const denied = requireAuth()
    if (denied) return denied
    const contacts =
      db.currentUser.role === 'APPRENANT'
        ? db.users.filter((item) => item.role === 'FORMATEUR')
        : db.users.filter((item) => item.role === 'APPRENANT')
    return HttpResponse.json(
      contacts.map((item) => ({
        id: item.id,
        nom: `${item.first_name} ${item.last_name}`,
        email: item.email,
        specialite: item.specialite,
      })),
    )
  }),

  http.get(api('/v1/chat/conversations/:id/messages/'), ({ params }) => {
    const denied = requireAuth()
    if (denied) return denied
    return HttpResponse.json(db.messages[params.id] || [])
  }),

  http.post(api('/v1/chat/conversations/start/'), async ({ request }) => {
    const denied = requireAuth()
    if (denied) return denied
    const body = await request.json()
    const peerId = body.formateur_id || body.apprenant_id
    const existing = db.conversations.find((item) => item.peer_id === peerId)
    if (existing) return HttpResponse.json(existing)

    const peer = db.users.find((item) => item.id === peerId)
    const conv = {
      id: `conv-${Date.now()}`,
      peer_id: peerId,
      peer_nom: peer ? `${peer.first_name} ${peer.last_name}` : 'Contact',
      peer_role: peer?.role || 'FORMATEUR',
      unread_count: 0,
      updated_at: new Date().toISOString(),
      last_message: null,
    }
    db.conversations.unshift(conv)
    db.messages[conv.id] = []
    return HttpResponse.json(conv, { status: 201 })
  }),

  http.post(api('/v1/chat/conversations/:id/messages/'), async ({ params, request }) => {
    const denied = requireAuth()
    if (denied) return denied
    const { body } = await request.json()
    const msg = {
      id: `msg-${Date.now()}`,
      body,
      sender: db.currentUser.id,
      is_mine: true,
      created_at: new Date().toISOString(),
    }
    db.messages[params.id] = db.messages[params.id] || []
    db.messages[params.id].push(msg)
    const conv = db.conversations.find((item) => item.id === params.id)
    if (conv) {
      conv.last_message = {
        id: msg.id,
        body: msg.body,
        sender_id: msg.sender,
        created_at: msg.created_at,
      }
      conv.updated_at = msg.created_at
    }
    return HttpResponse.json(msg, { status: 201 })
  }),

  http.get(api('/v1/live/sessions/'), () => {
    const denied = requireAuth()
    if (denied) return denied
    return HttpResponse.json(db.sessions)
  }),

  http.get(api('/v1/live/sessions/upcoming/'), () => {
    const denied = requireAuth()
    if (denied) return denied
    return HttpResponse.json(db.sessions)
  }),

  http.post(api('/v1/live/sessions/:id/join/'), ({ params }) => {
    const denied = requireAuth()
    if (denied) return denied
    const session = db.sessions.find((item) => item.id === params.id)
    if (!session) {
      return HttpResponse.json({ detail: 'Session introuvable.' }, { status: 404 })
    }
    return HttpResponse.json({
      ...session,
      display_name: `${db.currentUser.first_name} ${db.currentUser.last_name}`,
      is_moderator: db.currentUser.role === 'FORMATEUR',
    })
  }),

  http.post(api('/v1/live/sessions/:id/webrtc/heartbeat/'), () =>
    HttpResponse.json({ peers: [], remaining_seconds: 600 }),
  ),
  http.get(api('/v1/live/sessions/:id/webrtc/signals/'), () =>
    HttpResponse.json({ signals: [] }),
  ),
  http.post(api('/v1/live/sessions/:id/webrtc/signal/'), () => HttpResponse.json({})),
  http.post(api('/v1/live/sessions/:id/webrtc/leave/'), () => HttpResponse.json({})),
]
