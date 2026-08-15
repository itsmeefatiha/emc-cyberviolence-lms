import client from './client.js'

const QUIZZES_BASE = '/v1/quizzes'

// ---------------------------------------------------------------------------
// Quiz CRUD
// ---------------------------------------------------------------------------

export const listQuizzes = async (params = {}) => {
  const response = await client.get(`${QUIZZES_BASE}/quizzes/`, { params })
  return response.data
}

export const getQuiz = async (quizId) => {
  const response = await client.get(`${QUIZZES_BASE}/quizzes/${quizId}/`)
  return response.data
}

export const createQuiz = async (payload) => {
  const response = await client.post(`${QUIZZES_BASE}/quizzes/`, payload)
  return response.data
}

export const updateQuiz = async (quizId, payload) => {
  const response = await client.patch(`${QUIZZES_BASE}/quizzes/${quizId}/`, payload)
  return response.data
}

export const deleteQuiz = async (quizId) => {
  await client.delete(`${QUIZZES_BASE}/quizzes/${quizId}/`)
}

export const takeQuiz = async (quizId) => {
  const response = await client.get(`${QUIZZES_BASE}/quizzes/${quizId}/take/`)
  return response.data
}

export const submitQuiz = async (quizId, payload) => {
  const response = await client.post(`${QUIZZES_BASE}/quizzes/${quizId}/submit/`, payload)
  return response.data
}

export const generateQuizAi = async (payload) => {
  const response = await client.post(`${QUIZZES_BASE}/quizzes/generate-ai/`, payload)
  return response.data
}

// ---------------------------------------------------------------------------
// Questions & Options
// ---------------------------------------------------------------------------

export const createQuestion = async (payload) => {
  const response = await client.post(`${QUIZZES_BASE}/questions/`, payload)
  return response.data
}

export const updateQuestion = async (questionId, payload) => {
  const response = await client.patch(`${QUIZZES_BASE}/questions/${questionId}/`, payload)
  return response.data
}

export const deleteQuestion = async (questionId) => {
  await client.delete(`${QUIZZES_BASE}/questions/${questionId}/`)
}

export const createOption = async (payload) => {
  const response = await client.post(`${QUIZZES_BASE}/options/`, payload)
  return response.data
}

export const updateOption = async (optionId, payload) => {
  const response = await client.patch(`${QUIZZES_BASE}/options/${optionId}/`, payload)
  return response.data
}

export const deleteOption = async (optionId) => {
  await client.delete(`${QUIZZES_BASE}/options/${optionId}/`)
}

// ---------------------------------------------------------------------------
// Certificats
// ---------------------------------------------------------------------------

export const listCertificats = async () => {
  const response = await client.get(`${QUIZZES_BASE}/certificats/`)
  return response.data
}

export const getCertificat = async (certificatId) => {
  const response = await client.get(`${QUIZZES_BASE}/certificats/${certificatId}/`)
  return response.data
}

export const downloadCertificat = async (certificatId) => {
  const response = await client.get(`${QUIZZES_BASE}/certificats/${certificatId}/download/`)
  return response.data
}
