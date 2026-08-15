import { useCallback, useEffect, useState } from 'react'
import {
  Award,
  Download,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Calendar,
  BookOpen,
} from 'lucide-react'
import { listCertificats, downloadCertificat } from '../../api/quizzes.js'
import { resolveBackendUrl } from '../../utils/courseHelpers.js'

const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export default function Certificates() {
  const [certs, setCerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloadingId, setDownloadingId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listCertificats()
      const list = Array.isArray(data) ? data : data?.results || []
      setCerts(list)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Impossible de charger vos certificats.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleDownload = async (cert) => {
    setDownloadingId(cert.id)
    try {
      const data = await downloadCertificat(cert.id)
      const url = resolveBackendUrl(data.download_url || data.fichier_pdf || cert.fichier_pdf)
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer')
      } else {
        setError('Fichier PDF introuvable pour ce certificat.')
      }
    } catch (err) {
      setError(err?.response?.data?.detail || 'Échec du téléchargement.')
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold text-slate-900">
            <Award className="h-6 w-6 text-[#243491]" />
            Mes Certifications
          </h1>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Certificats obtenus après validation complète de vos parcours.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-[#243491]" />
          Chargement…
        </div>
      ) : certs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Award className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-3 text-sm font-bold text-slate-900">Aucun certificat pour le moment</h3>
          <p className="mt-1 text-xs text-slate-500">
            Terminez toutes les leçons d&apos;un parcours et validez le quiz final pour obtenir votre
            certificat PDF.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {certs.map((cert) => (
            <div
              key={cert.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                    <ShieldCheck className="h-3 w-3" /> Obtenu
                  </span>
                  <span className="text-[10px] font-medium text-slate-400">
                    {cert.code_verification}
                  </span>
                </div>
                <h3 className="mt-3 flex items-start gap-2 text-base font-bold text-slate-900">
                  <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-[#243491]" />
                  {cert.parcours_titre || 'Parcours'}
                </h3>
                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <Calendar className="h-3.5 w-3.5" />
                  Émis le {formatDate(cert.date_emission)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleDownload(cert)}
                disabled={downloadingId === cert.id}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#243491] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#1c2975] disabled:opacity-60"
              >
                {downloadingId === cert.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Télécharger le PDF
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
