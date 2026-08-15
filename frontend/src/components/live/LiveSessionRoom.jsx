import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Video,
  Mic,
  MicOff,
  VideoOff,
  PhoneOff,
  Users,
  Timer,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import {
  joinLiveSession,
  webrtcFetchSignals,
  webrtcHeartbeat,
  webrtcLeave,
  webrtcSendSignal,
} from '../../api/liveSessions.js'

function newPeerId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 32)
  }
  return `p${Date.now()}${Math.random().toString(16).slice(2, 10)}`
}

function formatCountdown(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n) => String(n).padStart(2, '0')
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(sec)}`
  return `${pad(m)}:${pad(sec)}`
}

function initialsFromName(name) {
  const parts = String(name || '')
    .replace(/\(vous\)/i, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

export default function LiveSessionRoom() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sessionMeta, setSessionMeta] = useState(null)
  const [remoteTiles, setRemoteTiles] = useState([])
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [peerCount, setPeerCount] = useState(0)
  const [remainingSeconds, setRemainingSeconds] = useState(null)
  const [endingSoon, setEndingSoon] = useState(false)
  const [sessionEndedOverlay, setSessionEndedOverlay] = useState(false)

  const localVideoRef = useRef(null)
  const localStreamRef = useRef(null)
  const peerIdRef = useRef(newPeerId())
  const pcsRef = useRef(new Map())
  const makingOfferRef = useRef(new Set())
  const iceServersRef = useRef([{ urls: 'stun:stun.l.google.com:19302' }])
  const displayNameRef = useRef('Participant')
  const aliveRef = useRef(true)
  const camOnRef = useRef(true)
  const micOnRef = useRef(true)
  const endAtRef = useRef(null)
  const endingRef = useRef(false)

  const backPath =
    user?.role === 'APPRENANT' ? '/live-sessions' : '/instructor/live-sessions'

  const upsertRemoteTile = useCallback((peerId, patch) => {
    setRemoteTiles((prev) => {
      const idx = prev.findIndex((t) => t.peerId === peerId)
      if (idx === -1) {
        return [
          ...prev,
          { peerId, stream: null, name: peerId, cameraOn: true, micOn: true, ...patch },
        ]
      }
      const next = [...prev]
      next[idx] = { ...next[idx], ...patch }
      return next
    })
  }, [])

  const removeRemoteTile = useCallback((peerId) => {
    setRemoteTiles((prev) => prev.filter((t) => t.peerId !== peerId))
  }, [])

  const sendSignal = useCallback(
    async (toPeerId, payload) => {
      try {
        await webrtcSendSignal(sessionId, {
          from_peer_id: peerIdRef.current,
          to_peer_id: toPeerId,
          payload,
        })
      } catch {
        /* ignore transient */
      }
    },
    [sessionId]
  )

  const ensurePeerConnection = useCallback(
    (remotePeerId, remoteName) => {
      if (pcsRef.current.has(remotePeerId)) {
        return pcsRef.current.get(remotePeerId)
      }

      const pc = new RTCPeerConnection({ iceServers: iceServersRef.current })
      pcsRef.current.set(remotePeerId, pc)

      const local = localStreamRef.current
      if (local) {
        local.getTracks().forEach((track) => pc.addTrack(track, local))
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal(remotePeerId, {
            type: 'candidate',
            candidate: event.candidate.toJSON(),
          })
        }
      }

      pc.ontrack = (event) => {
        const stream = event.streams[0]
        upsertRemoteTile(remotePeerId, {
          stream,
          name: remoteName || remotePeerId,
        })
      }

      return pc
    },
    [sendSignal, upsertRemoteTile]
  )

  const createOfferIfNeeded = useCallback(
    async (remotePeerId, remoteName) => {
      if (peerIdRef.current >= remotePeerId) return
      if (makingOfferRef.current.has(remotePeerId)) return

      const pc = ensurePeerConnection(remotePeerId, remoteName)
      if (pc.signalingState !== 'stable') return

      makingOfferRef.current.add(remotePeerId)
      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        await sendSignal(remotePeerId, {
          type: 'offer',
          sdp: pc.localDescription,
        })
      } catch {
        /* ignore */
      } finally {
        makingOfferRef.current.delete(remotePeerId)
      }
    },
    [ensurePeerConnection, sendSignal]
  )

  const handleSignal = useCallback(
    async (fromPeerId, payload, peerNameMap) => {
      const name = peerNameMap.get(fromPeerId) || fromPeerId
      const pc = ensurePeerConnection(fromPeerId, name)

      try {
        if (payload.type === 'offer') {
          await pc.setRemoteDescription(payload.sdp)
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          await sendSignal(fromPeerId, { type: 'answer', sdp: pc.localDescription })
        } else if (payload.type === 'answer') {
          if (pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(payload.sdp)
          }
        } else if (payload.type === 'candidate' && payload.candidate) {
          try {
            await pc.addIceCandidate(payload.candidate)
          } catch {
            /* ignore late candidates */
          }
        }
      } catch {
        /* ignore negotiation races */
      }
    },
    [ensurePeerConnection, sendSignal]
  )

  const cleanupMedia = useCallback(() => {
    pcsRef.current.forEach((pc) => {
      try {
        pc.close()
      } catch {
        /* ignore */
      }
    })
    pcsRef.current.clear()
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null
  }, [])

  const hangUp = useCallback(
    async ({ endedBySchedule = false } = {}) => {
      if (endingRef.current) return
      endingRef.current = true
      aliveRef.current = false
      cleanupMedia()
      try {
        await webrtcLeave(sessionId, peerIdRef.current)
      } catch {
        /* ignore */
      }
      if (endedBySchedule) {
        setSessionEndedOverlay(true)
        setTimeout(() => navigate(backPath), 2200)
      } else {
        navigate(backPath)
      }
    },
    [backPath, cleanupMedia, navigate, sessionId]
  )

  // Countdown + auto-end at date_fin
  useEffect(() => {
    if (!endAtRef.current || loading || error) return undefined

    const tick = () => {
      const endAt = endAtRef.current
      if (!endAt) return
      const remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000))
      setRemainingSeconds(remaining)
      setEndingSoon(remaining > 0 && remaining <= 300)
      if (remaining <= 0) {
        hangUp({ endedBySchedule: true })
      }
    }

    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [loading, error, hangUp, sessionMeta?.date_fin])

  useEffect(() => {
    aliveRef.current = true
    endingRef.current = false
    let pollTimer

    const boot = async () => {
      setLoading(true)
      setError('')
      try {
        const join = await joinLiveSession(sessionId)
        if (!aliveRef.current) return
        setSessionMeta(join)
        displayNameRef.current = join.display_name || 'Participant'
        if (Array.isArray(join.ice_servers) && join.ice_servers.length) {
          iceServersRef.current = join.ice_servers
        }
        if (join.date_fin) {
          endAtRef.current = new Date(join.date_fin).getTime()
          const remaining = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000))
          setRemainingSeconds(remaining)
          if (remaining <= 0) {
            setError('La session est déjà terminée.')
            setLoading(false)
            return
          }
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { facingMode: 'user' },
        })
        if (!aliveRef.current) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        localStreamRef.current = stream
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }

        const tick = async () => {
          if (!aliveRef.current) return
          try {
            const hb = await webrtcHeartbeat(sessionId, {
              peer_id: peerIdRef.current,
              display_name: displayNameRef.current,
              camera_on: camOnRef.current,
              mic_on: micOnRef.current,
            })

            if (hb.session_ended || (typeof hb.remaining_seconds === 'number' && hb.remaining_seconds <= 0)) {
              hangUp({ endedBySchedule: true })
              return
            }

            if (hb.date_fin) {
              endAtRef.current = new Date(hb.date_fin).getTime()
            }
            if (typeof hb.remaining_seconds === 'number') {
              setRemainingSeconds(hb.remaining_seconds)
            }

            const peers = hb.peers || []
            setPeerCount(peers.length)

            const nameMap = new Map(peers.map((p) => [p.peer_id, p.display_name]))
            const liveIds = new Set(peers.map((p) => p.peer_id))

            for (const id of [...pcsRef.current.keys()]) {
              if (!liveIds.has(id)) {
                pcsRef.current.get(id)?.close()
                pcsRef.current.delete(id)
                removeRemoteTile(id)
              }
            }

            for (const p of peers) {
              upsertRemoteTile(p.peer_id, {
                name: p.display_name || p.peer_id,
                isModerator: p.is_moderator,
                cameraOn: p.camera_on !== false,
                micOn: p.mic_on !== false,
              })
              await createOfferIfNeeded(p.peer_id, p.display_name)
            }

            const sig = await webrtcFetchSignals(sessionId, peerIdRef.current)
            for (const item of sig.signals || []) {
              await handleSignal(item.from_peer_id, item.payload, nameMap)
            }
          } catch (err) {
            if (err?.response?.data?.session_ended) {
              hangUp({ endedBySchedule: true })
            }
          }
        }

        await tick()
        pollTimer = setInterval(tick, 1500)
      } catch (err) {
        if (aliveRef.current) {
          setError(
            err?.response?.data?.detail ||
              err?.message ||
              'Impossible d’ouvrir la salle vidéo.'
          )
        }
      } finally {
        if (aliveRef.current) setLoading(false)
      }
    }

    boot()

    return () => {
      aliveRef.current = false
      if (pollTimer) clearInterval(pollTimer)
      cleanupMedia()
      // Leave with the peer id assigned during boot, not the value from effect start.
      // eslint-disable-next-line react-hooks/exhaustive-deps -- peerId is set asynchronously
      webrtcLeave(sessionId, peerIdRef.current).catch(() => {})
    }
  }, [
    sessionId,
    createOfferIfNeeded,
    handleSignal,
    removeRemoteTile,
    upsertRemoteTile,
    hangUp,
    cleanupMedia,
  ])

  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks()?.[0]
    if (!track) return
    track.enabled = !track.enabled
    micOnRef.current = track.enabled
    setMicOn(track.enabled)
  }

  const toggleCam = () => {
    const track = localStreamRef.current?.getVideoTracks()?.[0]
    if (!track) return
    track.enabled = !track.enabled
    camOnRef.current = track.enabled
    setCamOn(track.enabled)
  }

  const localName = sessionMeta?.display_name || 'Vous'

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-white">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to={backPath}
            onClick={(e) => {
              e.preventDefault()
              hangUp()
            }}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Quitter
          </Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">
              {sessionMeta?.titre || 'Salle de formation'}
            </p>
            <p className="flex items-center gap-1 text-[11px] text-slate-400">
              <Users className="h-3 w-3" />
              {peerCount + 1} participant{peerCount === 0 ? '' : 's'} · WebRTC natif EMC
            </p>
          </div>
        </div>

        {remainingSeconds !== null && !loading && !error ? (
          <div
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold tabular-nums ${
              remainingSeconds <= 0
                ? 'bg-red-500/20 text-red-300'
                : endingSoon
                  ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/40'
                  : 'bg-white/10 text-slate-100'
            }`}
            title="Temps restant"
          >
            <Timer className="h-4 w-4" />
            <span>{formatCountdown(remainingSeconds)}</span>
          </div>
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#243491]/30 text-[#93a0e8]">
            <Video className="h-4 w-4" />
          </div>
        )}
      </header>

      <div className="relative min-h-0 flex-1 p-3 sm:p-4">
        {loading ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-950">
            <Loader2 className="h-8 w-8 animate-spin text-[#93a0e8]" />
            <p className="text-sm text-slate-400">Ouverture de la salle…</p>
          </div>
        ) : null}

        {error ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950 p-6">
            <div className="max-w-md rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
              <AlertCircle className="mx-auto h-8 w-8 text-red-400" />
              <p className="mt-3 text-sm text-red-100">{error}</p>
              <Link
                to={backPath}
                className="mt-4 inline-flex rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20"
              >
                Retour aux sessions
              </Link>
            </div>
          </div>
        ) : null}

        {sessionEndedOverlay ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/90 p-6">
            <div className="max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-8 text-center shadow-xl">
              <Timer className="mx-auto h-10 w-10 text-amber-300" />
              <p className="mt-4 text-lg font-bold">Session terminée</p>
              <p className="mt-2 text-sm text-slate-400">
                L’horaire de fin est atteint. La visioconférence est fermée.
              </p>
            </div>
          </div>
        ) : null}

        <div
          className={`grid h-full gap-3 ${
            remoteTiles.length === 0
              ? 'grid-cols-1'
              : remoteTiles.length === 1
                ? 'grid-cols-1 md:grid-cols-2'
                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
          }`}
        >
          <Tile
            name={`${localName} (vous)`}
            badge={sessionMeta?.is_moderator ? 'Formateur' : null}
            videoRef={localVideoRef}
            muted
            cameraOn={camOn}
          />
          {remoteTiles.map((tile) => (
            <RemoteTile key={tile.peerId} tile={tile} />
          ))}
        </div>
      </div>

      {!loading && !error && !sessionEndedOverlay ? (
        <div className="flex shrink-0 items-center justify-center gap-3 border-t border-white/10 px-4 py-4">
          <ControlButton
            active={micOn}
            onClick={toggleMic}
            label={micOn ? 'Couper le micro' : 'Activer le micro'}
          >
            {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </ControlButton>
          <ControlButton
            active={camOn}
            onClick={toggleCam}
            label={camOn ? 'Couper la caméra' : 'Activer la caméra'}
          >
            {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </ControlButton>
          <button
            type="button"
            onClick={() => hangUp()}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
            title="Quitter"
          >
            <PhoneOff className="h-5 w-5" />
          </button>
        </div>
      ) : null}
    </div>
  )
}

function AvatarPlaceholder({ name }) {
  return (
    <div className="flex min-h-[220px] h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-slate-800 to-slate-900">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#243491] text-2xl font-extrabold tracking-wide text-white shadow-lg shadow-[#243491]/30">
        {initialsFromName(name)}
      </div>
      <p className="max-w-[80%] truncate px-4 text-center text-sm font-semibold text-slate-100">
        {String(name || '').replace(/\s*\(vous\)\s*/i, '')}
      </p>
    </div>
  )
}

function Tile({ name, badge, videoRef, muted, cameraOn = true }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-white/10">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className={`h-full min-h-[220px] w-full object-cover ${cameraOn ? '' : 'hidden'}`}
      />
      {!cameraOn ? <AvatarPlaceholder name={name} /> : null}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
        <span className="truncate text-xs font-semibold">{name}</span>
        <div className="flex items-center gap-1.5">
          {!cameraOn ? <VideoOff className="h-3.5 w-3.5 text-slate-300" /> : null}
          {badge ? (
            <span className="rounded-full bg-[#243491] px-2 py-0.5 text-[10px] font-bold">
              {badge}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function RemoteTile({ tile }) {
  const ref = useRef(null)
  const cameraOn = tile.cameraOn !== false

  useEffect(() => {
    if (ref.current && tile.stream) {
      ref.current.srcObject = tile.stream
    }
  }, [tile.stream])

  return (
    <div className="relative overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-white/10">
      {tile.stream ? (
        <video
          ref={ref}
          autoPlay
          playsInline
          className={`h-full min-h-[220px] w-full object-cover ${cameraOn ? '' : 'hidden'}`}
        />
      ) : (
        <div className="flex min-h-[220px] items-center justify-center text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}
      {tile.stream && !cameraOn ? <AvatarPlaceholder name={tile.name} /> : null}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
        <span className="truncate text-xs font-semibold">{tile.name}</span>
        <div className="flex items-center gap-1.5">
          {!cameraOn ? <VideoOff className="h-3.5 w-3.5 text-slate-300" /> : null}
          {tile.micOn === false ? <MicOff className="h-3.5 w-3.5 text-slate-300" /> : null}
          {tile.isModerator ? (
            <span className="rounded-full bg-[#243491] px-2 py-0.5 text-[10px] font-bold">
              Formateur
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function ControlButton({ children, onClick, active, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
        active ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-red-500/80 text-white hover:bg-red-500'
      }`}
    >
      {children}
    </button>
  )
}
