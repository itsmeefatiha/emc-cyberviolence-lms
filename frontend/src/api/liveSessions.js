import client from './client.js'

const LIVE_BASE = '/v1/live/sessions'

export const listLiveSessions = async (params = {}) => {
  const response = await client.get(`${LIVE_BASE}/`, { params })
  return response.data
}

export const getUpcomingLiveSessions = async () => {
  const response = await client.get(`${LIVE_BASE}/upcoming/`)
  return response.data
}

export const getLiveSession = async (sessionId) => {
  const response = await client.get(`${LIVE_BASE}/${sessionId}/`)
  return response.data
}

export const createLiveSession = async (payload) => {
  const response = await client.post(`${LIVE_BASE}/`, payload)
  return response.data
}

export const updateLiveSession = async (sessionId, payload) => {
  const response = await client.patch(`${LIVE_BASE}/${sessionId}/`, payload)
  return response.data
}

export const deleteLiveSession = async (sessionId) => {
  await client.delete(`${LIVE_BASE}/${sessionId}/`)
}

export const joinLiveSession = async (sessionId) => {
  const response = await client.post(`${LIVE_BASE}/${sessionId}/join/`)
  return response.data
}

export const webrtcHeartbeat = async (sessionId, payload) => {
  const response = await client.post(`${LIVE_BASE}/${sessionId}/webrtc/heartbeat/`, payload)
  return response.data
}

export const webrtcFetchSignals = async (sessionId, peerId) => {
  const response = await client.get(`${LIVE_BASE}/${sessionId}/webrtc/signals/`, {
    params: { peer_id: peerId },
  })
  return response.data
}

export const webrtcSendSignal = async (sessionId, payload) => {
  const response = await client.post(`${LIVE_BASE}/${sessionId}/webrtc/signal/`, payload)
  return response.data
}

export const webrtcLeave = async (sessionId, peerId) => {
  const response = await client.post(`${LIVE_BASE}/${sessionId}/webrtc/leave/`, {
    peer_id: peerId,
  })
  return response.data
}
