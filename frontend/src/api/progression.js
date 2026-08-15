import client from './client.js'

const PROGRESSION_BASE_URL = '/v1/progression'

// ============================================================================
// 1. OPERATIONS CRUD DE BASE (ViewSet Defaults)
// ============================================================================

export const listProgressions = async () => {
  const response = await client.get(`${PROGRESSION_BASE_URL}/`)
  return response.data
}

export const getProgression = async (progressionId) => {
  const response = await client.get(`${PROGRESSION_BASE_URL}/${progressionId}/`)
  return response.data
}

export const createProgression = async (payload) => {
  const response = await client.post(`${PROGRESSION_BASE_URL}/`, payload)
  return response.data
}

export const updateProgression = async (progressionId, payload) => {
  const response = await client.patch(`${PROGRESSION_BASE_URL}/${progressionId}/`, payload)
  return response.data
}

export const deleteProgression = async (progressionId) => {
  await client.delete(`${PROGRESSION_BASE_URL}/${progressionId}/`)
}

// ============================================================================
// 2. ENDPOINTS SUIVI APPRENANT (Tracking, Résumés & Reprise)
// ============================================================================

/**
 * Envoie un ping de suivi en temps réel pour une leçon.
 * @param {Object} payload - { lecon_id: string, temps_passe_ajoute?: number, statut?: string }
 */
export const trackLecon = async (payload) => {
  const response = await client.post(`${PROGRESSION_BASE_URL}/track/`, payload)
  return response.data
}

/**
 * Inscription formelle à un parcours.
 * @param {string} parcoursId
 */
export const enrollParcours = async (parcoursId) => {
  const response = await client.post(`${PROGRESSION_BASE_URL}/enroll/`, {
    parcours_id: parcoursId,
  })
  return response.data
}

/**
 * My Learning : parcours inscrits + favoris.
 */
export const getMyLearning = async () => {
  const response = await client.get(`${PROGRESSION_BASE_URL}/me/learning/`)
  return response.data
}

/**
 * Ajoute ou retire un parcours des favoris.
 * @param {string} parcoursId
 */
export const toggleFavorite = async (parcoursId) => {
  const response = await client.post(`${PROGRESSION_BASE_URL}/favorites/toggle/`, {
    parcours_id: parcoursId,
  })
  return response.data
}

/**
 * Liste des favoris de l'apprenant connecté.
 */
export const listFavorites = async () => {
  const response = await client.get(`${PROGRESSION_BASE_URL}/favorites/`)
  return response.data
}

/**
 * Récupère le résumé global de progression de l'apprenant connecté (pour le Dashboard Apprenant).
 */
export const getMySummary = async () => {
  const response = await client.get(`${PROGRESSION_BASE_URL}/me/summary/`)
  return response.data
}

/**
 * Temps d'apprentissage agrégé par jour (graphique Activité).
 * @param {'weekly'|'monthly'} [period='weekly']
 */
export const getMyActivity = async (period = 'weekly') => {
  const response = await client.get(`${PROGRESSION_BASE_URL}/me/activity/`, {
    params: { period },
  })
  return response.data
}

/**
 * Récupère la dernière activité de l'apprenant connecté ("Reprendre là où je m'étais arrêté").
 */
export const getMyResume = async () => {
  const response = await client.get(`${PROGRESSION_BASE_URL}/me/resume/`)
  return response.data
}

/**
 * Récupère le résumé de progression de l'apprenant pour un parcours spécifique.
 */
export const getParcoursSummary = async (parcoursId) => {
  const response = await client.get(`${PROGRESSION_BASE_URL}/parcours/${parcoursId}/summary/`)
  return response.data
}

/**
 * Récupère les statistiques détaillées (pourcentage, temps total) d'un parcours pour l'utilisateur.
 */
export const getParcoursStats = async (parcoursId) => {
  const response = await client.get(`${PROGRESSION_BASE_URL}/parcours/${parcoursId}/stats/`)
  return response.data
}

/**
 * Récupère le résumé de progression de l'apprenant pour un module spécifique.
 */
export const getModuleSummary = async (moduleId) => {
  const response = await client.get(`${PROGRESSION_BASE_URL}/module/${moduleId}/summary/`)
  return response.data
}

// ============================================================================
// 3. ENDPOINTS ENCADRANT / FORMATEUR / ADMIN (Dashboard & Validation Manuel)
// ============================================================================

/**
 * Récupère le tableau de bord global de l'encadrant.
 * @param {Object} [params] - ex: { profil_professionnel: 'EDUCATEUR' }
 */
export const getFacilitatorDashboard = async (params = {}) => {
  const response = await client.get(`${PROGRESSION_BASE_URL}/dashboard/`, { params })
  return response.data
}

/**
 * Valide manuellement l'intégralité des leçons d'un module pour un apprenant.
 * @param {string} moduleId
 * @param {Object} [payload] - ex: { apprenant_id: "UUID" }
 */
export const validateModule = async (moduleId, payload = {}) => {
  const response = await client.post(`${PROGRESSION_BASE_URL}/module/${moduleId}/validate/`, payload)
  return response.data
}

/**
 * Valide manuellement l'intégralité des leçons d'un parcours pour un apprenant.
 * @param {string} parcoursId
 * @param {Object} [payload] - ex: { apprenant_id: "UUID" }
 */
export const validateParcours = async (parcoursId, payload = {}) => {
  const response = await client.post(`${PROGRESSION_BASE_URL}/parcours/${parcoursId}/validate/`, payload)
  return response.data
}