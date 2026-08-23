export const TEST_PASSWORD = 'Password1!'

export const USERS = {
  learner: {
    id: 'user-apprenant',
    first_name: 'Amina',
    last_name: 'Benali',
    username: 'amina',
    email: 'amina@example.com',
    role: 'APPRENANT',
    telephone: '0612345678',
    profil_professionnel: 'EDUCATEUR',
    specialite: 'Milieu scolaire',
    is_active: true,
    photo: null,
  },
  instructor: {
    id: 'user-formateur',
    first_name: 'Karim',
    last_name: 'Haddad',
    username: 'karim',
    email: 'karim@example.com',
    role: 'FORMATEUR',
    telephone: '0698765432',
    profil_professionnel: '',
    specialite: 'Cyberviolence',
    is_active: true,
    photo: null,
  },
  admin: {
    id: 'user-admin',
    first_name: 'Nadia',
    last_name: 'El Fassi',
    username: 'nadia',
    email: 'nadia@example.com',
    role: 'ADMIN',
    telephone: '0600000000',
    profil_professionnel: '',
    specialite: '',
    is_active: true,
    photo: null,
  },
}

function liveWindow() {
  const start = new Date(Date.now() - 15 * 60 * 1000)
  const end = new Date(Date.now() + 45 * 60 * 1000)
  return { date_debut: start.toISOString(), date_fin: end.toISOString() }
}

function createInitialDb() {
  const { date_debut, date_fin } = liveWindow()

  return {
    currentUser: null,
    users: [USERS.learner, USERS.instructor, USERS.admin].map((user) => ({ ...user })),
    enrolledIds: new Set(),
    favoriteIds: new Set(),
    completedIds: new Set(),
    parcours: [
      {
        id: 'parcours-1',
        titre: 'Cyberviolence et école',
        description: 'Repérer et accompagner les situations de cyberharcèlement en milieu scolaire.',
        profil_cible: 'EDUCATEUR',
        profil_cible_display: 'Éducateur',
        statut: 'PUBLIE',
        formateur: USERS.instructor.id,
        formateur_nom: 'Karim Haddad',
        publie_par: 'Karim Haddad',
        formateur_role: 'FORMATEUR',
        image: null,
        nombre_modules: 1,
        nombre_lecons: 1,
        date_creation: '2026-01-12T10:00:00Z',
        modules: [
          {
            id: 'module-1',
            titre: 'Repérer le cyberharcèlement',
            description: 'Signaux faibles et conduite à tenir.',
            ordre: 1,
            lecons: [
              {
                id: 'lecon-1',
                titre: 'Qu’est-ce que le cyberharcèlement ?',
                duree_estimee: 12,
                ordre: 1,
                contenu: {
                  type_contenu: 'TEXTE',
                  details: {
                    type: 'TEXTE',
                    id: 'contenu-1',
                    titre_fichier: 'Introduction',
                    corps: 'Le cyberharcèlement est une violence répétée exercée en ligne.',
                  },
                },
              },
            ],
            quizzes: [
              {
                id: 'quiz-1',
                titre: 'Quiz module 1',
                description: 'Vérifiez vos acquis.',
                note_de_passage: 80,
                duree_minutes: 10,
                max_tentatives: 3,
                questions_count: 1,
                deja_reussi: false,
              },
            ],
          },
        ],
      },
    ],
    conversations: [
      {
        id: 'conv-1',
        peer_id: USERS.instructor.id,
        peer_nom: 'Karim Haddad',
        peer_role: 'FORMATEUR',
        unread_count: 1,
        updated_at: '2026-03-01T09:00:00Z',
        last_message: {
          id: 'msg-1',
          body: 'Bonjour Amina, des questions sur le module 1 ?',
          sender_id: USERS.instructor.id,
          created_at: '2026-03-01T09:00:00Z',
        },
      },
    ],
    messages: {
      'conv-1': [
        {
          id: 'msg-1',
          body: 'Bonjour Amina, des questions sur le module 1 ?',
          sender: USERS.instructor.id,
          is_mine: false,
          created_at: '2026-03-01T09:00:00Z',
        },
      ],
    },
    notifications: [
      {
        id: 'notif-1',
        titre: 'Nouveau message',
        message: 'Karim Haddad vous a écrit',
        est_lue: false,
        type_notification: 'MESSAGE',
        date_creation: '2026-03-01T09:00:00Z',
        lien: '/chat',
      },
    ],
    sessions: [
      {
        id: 'session-1',
        titre: 'Visio de rentrée — cyberviolence',
        description: 'Session live d’accompagnement.',
        profil_cible: 'EDUCATEUR',
        statut: 'EN_COURS',
        date_debut,
        date_fin,
        formateur_nom: 'Karim Haddad',
        formateur_photo: null,
        peut_rejoindre: true,
      },
    ],
    certificats: [
      {
        id: 'cert-1',
        parcours_titre: 'Cyberviolence et école',
        date_obtention: '2026-02-20T12:00:00Z',
        fichier_pdf: '/media/certificats/cert-1.pdf',
      },
    ],
  }
}

export const db = createInitialDb()

export function resetDb() {
  const next = createInitialDb()
  db.currentUser = next.currentUser
  db.users = next.users
  db.enrolledIds = next.enrolledIds
  db.favoriteIds = next.favoriteIds
  db.completedIds = next.completedIds
  db.parcours = next.parcours
  db.conversations = next.conversations
  db.messages = next.messages
  db.notifications = next.notifications
  db.sessions = next.sessions
  db.certificats = next.certificats
}

export function setCurrentUser(user) {
  db.currentUser = user ? { ...user } : null
}
