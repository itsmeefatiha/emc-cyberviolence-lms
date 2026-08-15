import client from './client.js'

const COURSES_BASE_URL = '/v1/courses'

const appendIfPresent = (formData, key, value) => {
  if (value !== undefined && value !== null && value !== '') {
    formData.append(key, value)
  }
}

export const listParcours = async () => {
  const response = await client.get(`${COURSES_BASE_URL}/parcours/`)
  return response.data
}

export const getParcours = async (parcoursId) => {
  const response = await client.get(`${COURSES_BASE_URL}/parcours/${parcoursId}/`)
  return response.data
}

export const createParcours = async (payload) => {
  const isFormData = typeof FormData !== 'undefined' && payload instanceof FormData
  const response = await client.post(`${COURSES_BASE_URL}/parcours/`, payload, {
    headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
  })
  return response.data
}

export const updateParcours = async (parcoursId, payload) => {
  const isFormData = typeof FormData !== 'undefined' && payload instanceof FormData
  const response = await client.patch(`${COURSES_BASE_URL}/parcours/${parcoursId}/`, payload, {
    headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
  })
  return response.data
}

export const deleteParcours = async (parcoursId) => {
  await client.delete(`${COURSES_BASE_URL}/parcours/${parcoursId}/`)
}

export const createModule = async (payload) => {
  const response = await client.post(`${COURSES_BASE_URL}/modules/`, payload)
  return response.data
}

export const updateModule = async (moduleId, payload) => {
  const response = await client.patch(`${COURSES_BASE_URL}/modules/${moduleId}/`, payload)
  return response.data
}

export const deleteModule = async (moduleId) => {
  await client.delete(`${COURSES_BASE_URL}/modules/${moduleId}/`)
}

export const buildLeconPayload = (data, moduleId) => {
  const payload = new FormData()

  appendIfPresent(payload, 'module', moduleId)
  appendIfPresent(payload, 'titre', data.titre)
  appendIfPresent(payload, 'duree_estimee', data.duree_estimee)
  appendIfPresent(payload, 'ordre', data.ordre)

  if (data.contenuType && data.contenuType !== 'SANS_CONTENU') {
    appendIfPresent(payload, 'contenu_type', data.contenuType)

    if (data.contenuType === 'TEXTE') {
      appendIfPresent(payload, 'contenu_corps', data.corps)
      appendIfPresent(payload, 'contenu_titre_fichier', data.titre_fichier || data.titre || 'Texte')
    } else {
      // DOCUMENT / VIDEO / SCORM — titre_fichier optional (backend can auto-detect from file)
      appendIfPresent(payload, 'contenu_titre_fichier', data.titre_fichier)
      appendIfPresent(payload, 'contenu_format', data.format)
      appendIfPresent(payload, 'contenu_standard', data.standard)
      appendIfPresent(payload, 'contenu_version', data.version)

      if (data.contenuType === 'DOCUMENT') {
        appendIfPresent(payload, 'contenu_fichier', data.contenu_fichier)
      }

      if (data.contenuType === 'VIDEO') {
        appendIfPresent(payload, 'contenu_video_source', data.contenu_video_source)
      }

      if (data.contenuType === 'SCORM') {
        appendIfPresent(payload, 'contenu_package_url', data.contenu_package_url)
      }
    }
  }

  return payload
}

export const reorderModules = async (items) => {
  const response = await client.post(`${COURSES_BASE_URL}/modules/reorder/`, items)
  return response.data
}

export const reorderLecons = async (items) => {
  const response = await client.post(`${COURSES_BASE_URL}/lecons/reorder/`, items)
  return response.data
}

export const createLecon = async (payload) => {
  const response = await client.post(`${COURSES_BASE_URL}/lecons/`, payload)
  return response.data
}

export const updateLecon = async (leconId, payload) => {
  const response = await client.patch(`${COURSES_BASE_URL}/lecons/${leconId}/`, payload)
  return response.data
}

export const deleteLecon = async (leconId) => {
  await client.delete(`${COURSES_BASE_URL}/lecons/${leconId}/`)
}
