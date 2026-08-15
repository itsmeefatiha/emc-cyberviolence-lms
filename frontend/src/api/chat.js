import client from './client.js'

const CHAT_BASE = '/v1/chat'

export const listChatContacts = async () => {
  const response = await client.get(`${CHAT_BASE}/contacts/`)
  return response.data
}

export const listConversations = async () => {
  const response = await client.get(`${CHAT_BASE}/conversations/`)
  return response.data
}

export const startConversation = async (payload) => {
  const response = await client.post(`${CHAT_BASE}/conversations/start/`, payload)
  return response.data
}

export const listMessages = async (conversationId) => {
  const response = await client.get(`${CHAT_BASE}/conversations/${conversationId}/messages/`)
  return response.data
}

export const sendMessage = async (conversationId, body) => {
  const response = await client.post(`${CHAT_BASE}/conversations/${conversationId}/messages/`, {
    body,
  })
  return response.data
}
