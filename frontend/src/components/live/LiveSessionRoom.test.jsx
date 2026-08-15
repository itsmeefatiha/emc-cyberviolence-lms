import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LiveSessionRoom from './LiveSessionRoom'
import { mockAuth, resetMockAuth } from '../../test/authMock.js'
import { renderWithRouter } from '../../test/test-utils.jsx'

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => mockAuth,
}))

vi.mock('../../api/liveSessions.js', () => ({
  joinLiveSession: vi.fn(),
  webrtcFetchSignals: vi.fn(),
  webrtcHeartbeat: vi.fn(),
  webrtcLeave: vi.fn(),
  webrtcSendSignal: vi.fn(),
}))

import {
  joinLiveSession,
  webrtcFetchSignals,
  webrtcHeartbeat,
  webrtcLeave,
} from '../../api/liveSessions.js'

function mockMediaStream() {
  const audioTrack = { kind: 'audio', enabled: true, stop: vi.fn() }
  const videoTrack = { kind: 'video', enabled: true, stop: vi.fn() }
  return {
    getTracks: () => [audioTrack, videoTrack],
    getAudioTracks: () => [audioTrack],
    getVideoTracks: () => [videoTrack],
  }
}

describe('LiveSessionRoom', () => {
  beforeEach(() => {
    resetMockAuth({ user: { first_name: 'Amina', role: 'APPRENANT' } })
    joinLiveSession.mockReset()
    webrtcHeartbeat.mockReset()
    webrtcFetchSignals.mockReset()
    webrtcLeave.mockResolvedValue({})
    webrtcHeartbeat.mockResolvedValue({ peers: [], remaining_seconds: 600 })
    webrtcFetchSignals.mockResolvedValue({ signals: [] })

    navigator.mediaDevices.getUserMedia = vi.fn().mockResolvedValue(mockMediaStream())
    globalThis.RTCPeerConnection = class {
      close() {}
      addTrack() {}
    }
  })

  it('affiche le chargement puis le titre de la session', async () => {
    joinLiveSession.mockResolvedValue({
      titre: 'Visio cyberviolence',
      display_name: 'Amina Benali',
      is_moderator: false,
    })

    renderWithRouter(<LiveSessionRoom />, {
      route: '/live-sessions/12/room',
      path: '/live-sessions/:sessionId/room',
    })

    expect(screen.getByText('Ouverture de la salle…')).toBeInTheDocument()
    expect(await screen.findByText('Visio cyberviolence')).toBeInTheDocument()
    expect(screen.getByText(/Amina Benali \(vous\)/)).toBeInTheDocument()
    expect(screen.getByTitle('Couper le micro')).toBeInTheDocument()
    expect(screen.getByTitle('Couper la caméra')).toBeInTheDocument()
  })

  it('affiche une erreur si l’entrée en salle échoue', async () => {
    joinLiveSession.mockRejectedValue({
      response: { data: { detail: 'Session complète.' } },
    })

    renderWithRouter(<LiveSessionRoom />, {
      route: '/live-sessions/12/room',
      path: '/live-sessions/:sessionId/room',
    })

    expect(await screen.findByText('Session complète.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Retour aux sessions' })).toHaveAttribute(
      'href',
      '/live-sessions',
    )
    expect(screen.queryByTitle('Couper le micro')).not.toBeInTheDocument()
  })

  it('coupe le micro au clic', async () => {
    joinLiveSession.mockResolvedValue({
      titre: 'Visio',
      display_name: 'Amina',
    })

    const { user } = renderWithRouter(<LiveSessionRoom />, {
      route: '/live-sessions/12/room',
      path: '/live-sessions/:sessionId/room',
    })

    await screen.findByTitle('Couper le micro')
    await user.click(screen.getByTitle('Couper le micro'))
    expect(await screen.findByTitle('Activer le micro')).toBeInTheDocument()
  })

  it('quitte la salle et notifie le backend', async () => {
    joinLiveSession.mockResolvedValue({
      titre: 'Visio',
      display_name: 'Amina',
    })

    const { user } = renderWithRouter(<LiveSessionRoom />, {
      route: '/live-sessions/12/room',
      path: '/live-sessions/:sessionId/room',
    })

    await screen.findByText('Visio')
    await user.click(screen.getByTitle('Quitter'))

    await waitFor(() => {
      expect(webrtcLeave).toHaveBeenCalled()
    })
  })
})
