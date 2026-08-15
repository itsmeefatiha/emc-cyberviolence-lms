import client from './client.js'

export const listUsers = async () => {
  const response = await client.get('/auth/users/')
  return response.data
}

export const createUser = async (payload) => {
  const response = await client.post('/auth/users/', payload)
  return response.data
}

export const updateUser = async (userId, payload) => {
  const response = await client.patch(`/auth/users/${userId}/`, payload)
  return response.data
}

export const deleteUser = async (userId) => {
  await client.delete(`/auth/users/${userId}/`)
}