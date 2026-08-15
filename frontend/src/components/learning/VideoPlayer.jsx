import { useEffect, useRef, useState } from 'react'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  PictureInPicture2,
  RotateCcw,
  RotateCw,
} from 'lucide-react'
import { formatVideoTime } from '../../utils/courseHelpers.js'

const PLAYBACK_RATES = [1, 1.25, 1.5]

/**
 * Lecteur vidéo personnalisé style Coursera.
 */
export default function VideoPlayer({
  src,
  autoPlay = true,
  onProgress,
  onNearComplete,
  onEnded,
}) {
  const videoRef = useRef(null)
  const containerRef = useRef(null)
  const lastPingRef = useRef(0)
  const nearCompleteFiredRef = useRef(false)

  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [rate, setRate] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const hideTimerRef = useRef(null)

  useEffect(() => {
    nearCompleteFiredRef.current = false
    lastPingRef.current = 0
    const video = videoRef.current
    if (!video) return
    video.load()
    if (autoPlay) {
      video.play().catch(() => setPlaying(false))
    }
  }, [src, autoPlay])

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  const scheduleHideControls = () => {
    clearTimeout(hideTimerRef.current)
    setShowControls(true)
    if (playing) {
      hideTimerRef.current = setTimeout(() => setShowControls(false), 2800)
    }
  }

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play().catch(() => {})
    } else {
      video.pause()
    }
  }

  const seekBy = (delta) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + delta))
  }

  const handleTimeUpdate = () => {
    const video = videoRef.current
    if (!video) return
    setCurrentTime(video.currentTime)
    setDuration(video.duration || 0)

    const now = Date.now()
    if (now - lastPingRef.current >= 10000 && playing) {
      lastPingRef.current = now
      onProgress?.(10, video.currentTime, video.duration)
    }

    if (
      video.duration > 0 &&
      video.currentTime / video.duration >= 0.9 &&
      !nearCompleteFiredRef.current
    ) {
      nearCompleteFiredRef.current = true
      onNearComplete?.(video.currentTime, video.duration)
    }
  }

  const handleSeek = (event) => {
    const video = videoRef.current
    if (!video || !duration) return
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    video.currentTime = ratio * duration
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setMuted(video.muted)
  }

  const changeVolume = (value) => {
    const video = videoRef.current
    if (!video) return
    const next = Number(value)
    video.volume = next
    video.muted = next === 0
    setVolume(next)
    setMuted(next === 0)
  }

  const cycleRate = () => {
    const idx = PLAYBACK_RATES.indexOf(rate)
    const next = PLAYBACK_RATES[(idx + 1) % PLAYBACK_RATES.length]
    const video = videoRef.current
    if (video) video.playbackRate = next
    setRate(next)
  }

  const togglePiP = async () => {
    const video = videoRef.current
    if (!video) return
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture()
      }
    } catch {
      /* PiP non supporté */
    }
  }

  const toggleFullscreen = async () => {
    const el = containerRef.current
    if (!el) return
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await el.requestFullscreen()
      }
    } catch {
      /* fullscreen non supporté */
    }
  }

  if (!src) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-none bg-slate-900 text-sm text-slate-400">
        Aucune vidéo disponible pour cette leçon.
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="group relative aspect-video w-full overflow-hidden bg-black"
      onMouseMove={scheduleHideControls}
      onMouseLeave={() => playing && setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={src}
        className="h-full w-full"
        playsInline
        onClick={togglePlay}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleTimeUpdate}
        onEnded={() => {
          setPlaying(false)
          onEnded?.()
        }}
      />

      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-3 pt-10 transition-opacity duration-200 ${
          showControls || !playing ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Scrubbar */}
        <div
          className="mb-2 h-1.5 cursor-pointer rounded-full bg-white/30"
          onClick={handleSeek}
          role="slider"
          aria-valuenow={currentTime}
          aria-valuemin={0}
          aria-valuemax={duration}
          tabIndex={0}
        >
          <div
            className="h-full rounded-full bg-[#243491]"
            style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
          />
        </div>

        <div className="flex items-center gap-2 text-white">
          <button type="button" onClick={togglePlay} className="rounded p-1.5 hover:bg-white/10" aria-label="Play/Pause">
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>

          <button type="button" onClick={() => seekBy(-10)} className="rounded p-1.5 hover:bg-white/10" aria-label="-10s">
            <RotateCcw className="h-4 w-4" />
            <span className="sr-only">-10s</span>
          </button>
          <button type="button" onClick={() => seekBy(10)} className="rounded p-1.5 hover:bg-white/10" aria-label="+10s">
            <RotateCw className="h-4 w-4" />
          </button>

          <span className="ml-1 text-xs font-medium tabular-nums text-white/90">
            {formatVideoTime(currentTime)} / {formatVideoTime(duration)}
          </span>

          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={toggleMute} className="rounded p-1.5 hover:bg-white/10">
              {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={muted ? 0 : volume}
              onChange={(e) => changeVolume(e.target.value)}
              className="hidden w-20 accent-[#243491] sm:block"
            />

            <button
              type="button"
              onClick={cycleRate}
              className="rounded px-2 py-1 text-xs font-bold hover:bg-white/10"
            >
              {rate}x
            </button>

            <button type="button" onClick={togglePiP} className="rounded p-1.5 hover:bg-white/10" title="Mini-lecteur">
              <PictureInPicture2 className="h-4 w-4" />
            </button>

            <button type="button" onClick={toggleFullscreen} className="rounded p-1.5 hover:bg-white/10">
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
