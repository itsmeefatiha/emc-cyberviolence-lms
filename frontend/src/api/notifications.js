import client from './client.js'

const BASE = '/v1/notifications'

export const listNotifications = async (params = {}) => {
  const response = await client.get(`${BASE}/`, { params })
  return response.data
}

export const getUnreadNotificationsCount = async () => {
  const response = await client.get(`${BASE}/unread-count/`)
  return response.data
}

export const markNotificationRead = async (id) => {
  const response = await client.post(`${BASE}/${id}/mark-read/`)
  return response.data
}

export const markAllNotificationsRead = async () => {
  const response = await client.post(`${BASE}/mark-all-read/`)
  return response.data
}
