import { API_BASE_URL } from '../api/client.js'

/**
 * Origine du backend Django (ex: http://localhost:8000).
 * Chaîne vide si l'API est relative (/api) — on passe alors par le proxy Vite.
 */
export const getBackendOrigin = () => {
  const apiBase = API_BASE_URL || 'http://localhost:8000/api'
  if (apiBase.startsWith('/')) {
    return ''
  }
  try {
    return new URL(apiBase).origin
  } catch {
    return 'http://localhost:8000'
  }
}

/**
 * Résout une URL média Django pour l'affichage dans le navigateur.
 * En développement, renvoie un chemin relatif `/media/...` pour passer
 * par le proxy Vite (même origine → PDF iframe + vidéo OK).
 */
export const resolveBackendUrl = (value) => {
  if (!value) return ''

  let pathname = value
  let search = ''

  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value)
      pathname = parsed.pathname
      search = parsed.search || ''
    } catch {
      return value
    }
  } else if (!value.startsWith('/')) {
    pathname = `/media/${value.replace(/^\/+/, '')}`
  }

  // Les FileField renvoient parfois le chemin relatif sans préfixe /media/
  if (
    pathname &&
    !pathname.startsWith('/media/') &&
    !pathname.startsWith('/static/') &&
    !pathname.startsWith('/api/')
  ) {
    pathname = `/media/${pathname.replace(/^\/+/, '')}`
  }

  const relativePath = `${pathname}${search}`

  // Dev ou API relative : même origine via proxy Vite
  if (import.meta.env.DEV || !getBackendOrigin()) {
    return relativePath
  }

  return `${getBackendOrigin()}${relativePath}`
}

/** URL absolue backend (utile en fallback si le proxy Vite échoue). */
export const resolveAbsoluteMediaUrl = (value) => {
  const relative = resolveBackendUrl(value)
  if (!relative) return ''
  if (/^https?:\/\//i.test(relative)) return relative
  const origin = getBackendOrigin() || 'http://127.0.0.1:8000'
  return `${origin}${relative}`
}

export const normalizeContenu = (contenu) => {
  if (!contenu) return null

  const details = contenu.details || {}
  const type = contenu.type_contenu

  if (type === 'TEXTE' || details.type === 'TEXTE') {
    return {
      id: details.id || contenu.id,
      type: 'TEXTE',
      corps: details.corps || contenu.corps || '',
      titre_fichier: details.titre_fichier || contenu.titre_fichier || '',
    }
  }

  if (type === 'DOCUMENT' || details.type === 'DOCUMENT') {
    return {
      id: details.id || contenu.id,
      type: 'DOCUMENT',
      titre_fichier: details.titre_fichier || contenu.titre_fichier || '',
      format: details.format || 'PDF',
      fichier: details.fichier || '',
    }
  }

  if (type === 'VIDEO' || details.type === 'VIDEO') {
    const stream = details.url_stream || ''
    const source = details.fichier_source || ''
    // Ignorer les faux flux HLS (.m3u8) générés par l'ancien pipeline
    const streamUsable = stream && !/\.m3u8($|\?)/i.test(stream)
    return {
      id: details.id || contenu.id,
      type: 'VIDEO',
      titre_fichier: details.titre_fichier || contenu.titre_fichier || '',
      statut_encodage: details.statut_encodage || 'PRET',
      url_stream: streamUsable ? stream : source || stream,
      fichier_source: source,
      duree: details.duree || 0,
    }
  }

  if (type === 'SCORM' || details.type === 'SCORM') {
    return {
      id: details.id || contenu.id,
      type: 'SCORM',
      titre_fichier: details.titre_fichier || contenu.titre_fichier || '',
      standard: details.standard || 'SCORM 1.2',
      version: details.version || '1.2',
      launch_path_url: details.launch_path_url || '',
    }
  }

  return null
}

export const normalizeLecon = (lecon) => ({
  id: lecon.id,
  titre: lecon.titre,
  duree_estimee: lecon.duree_estimee,
  ordre: lecon.ordre,
  contenu: normalizeContenu(lecon.contenu),
  type: normalizeContenu(lecon.contenu)?.type || 'GENERIC',
})

export const normalizeModule = (module) => ({
  id: module.id,
  titre: module.titre,
  description: module.description || '',
  ordre: module.ordre,
  lecons: (module.lecons || []).map(normalizeLecon),
  quizzes: (module.quizzes || []).map((quiz) => ({
    id: quiz.id,
    titre: quiz.titre,
    description: quiz.description || '',
    note_de_passage: quiz.note_de_passage ?? 80,
    duree_minutes: quiz.duree_minutes ?? 30,
    max_tentatives: quiz.max_tentatives ?? 3,
    lecon: quiz.lecon || null,
    questions_count: quiz.questions_count ?? 0,
    deja_reussi: Boolean(quiz.deja_reussi),
    type: 'QUIZ',
  })),
})

export const normalizeParcours = (parcours) => ({
  id: parcours.id,
  titre: parcours.titre,
  description: parcours.description || '',
  profil_cible: parcours.profil_cible,
  statut: parcours.statut,
  formateur: parcours.publie_par || parcours.formateur_nom || parcours.formateur || '',
  formateur_role: parcours.formateur_role || null,
  publie_par: parcours.publie_par || parcours.formateur_nom || '',
  image: parcours.image || null,
  is_enrolled: Boolean(parcours.is_enrolled),
  is_favorite: Boolean(parcours.is_favorite),
  modules: (parcours.modules || [])
    .map(normalizeModule)
    .sort((a, b) => (a.ordre || 0) - (b.ordre || 0)),
})

/** Flat ordered list of curriculum items (lessons + quizzes) for navigation. */
export const flattenCurriculum = (modules = []) => {
  const items = []
  const sortedModules = [...modules].sort((a, b) => (a.ordre || 0) - (b.ordre || 0))

  sortedModules.forEach((module) => {
    const lecons = [...(module.lecons || [])].sort((a, b) => (a.ordre || 0) - (b.ordre || 0))
    lecons.forEach((lecon) => {
      items.push({
        kind: 'LECON',
        id: lecon.id,
        moduleId: module.id,
        moduleTitre: module.titre,
        titre: lecon.titre,
        type: lecon.type || lecon.contenu?.type || 'GENERIC',
        duree_estimee: lecon.duree_estimee,
        lecon,
      })
    })

    ;(module.quizzes || []).forEach((quiz) => {
      items.push({
        kind: 'QUIZ',
        id: quiz.id,
        moduleId: module.id,
        moduleTitre: module.titre,
        titre: quiz.titre,
        type: 'QUIZ',
        duree_estimee: quiz.duree_minutes,
        deja_reussi: Boolean(quiz.deja_reussi),
        quiz,
      })
    })
  })

  return items
}

export const formatDuration = (minutes) => {
  if (!minutes || minutes <= 0) return ''
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}min` : `${h}h`
}

export const formatVideoTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export const isPdfFile = (urlOrName = '', format = '') => {
  const haystack = `${urlOrName} ${format}`.toLowerCase()
  return haystack.includes('.pdf') || haystack.includes('pdf')
}
