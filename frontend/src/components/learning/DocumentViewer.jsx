import { useEffect, useState } from 'react'
import { ExternalLink, FileText, Loader2 } from 'lucide-react'
import { isPdfFile, resolveAbsoluteMediaUrl } from '../../utils/courseHelpers.js'

/**
 * Affiche un document (PDF via blob URL pour fiabilité navigateur).
 */
export default function DocumentViewer({ src, title = 'Document', format = 'PDF' }) {
  const [blobUrl, setBlobUrl] = useState('')
  const [loading, setLoading] = useState(Boolean(src))
  const [error, setError] = useState('')

  const isPdf = isPdfFile(src, format) || isPdfFile(title, format)

  useEffect(() => {
    let cancelled = false
    let objectUrl = ''

    const tryFetch = async (url) => {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response.blob()
    }

    const load = async () => {
      setBlobUrl('')
      setError('')
      if (!src) {
        setLoading(false)
        return
      }

      if (!isPdf) {
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        let blob
        try {
          blob = await tryFetch(src)
        } catch {
          // Fallback : URL absolue directe vers Django
          const absolute = resolveAbsoluteMediaUrl(src)
          blob = await tryFetch(absolute)
        }
        const pdfBlob =
          blob.type && blob.type.includes('pdf')
            ? blob
            : new Blob([blob], { type: 'application/pdf' })
        objectUrl = URL.createObjectURL(pdfBlob)
        if (!cancelled) setBlobUrl(objectUrl)
      } catch (err) {
        console.error('DocumentViewer fetch error:', err)
        if (!cancelled) {
          setError('Impossible de charger le document. Utilisez le lien ci-dessous.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [src, isPdf])

  if (!src) {
    return (
      <div className="flex h-[40vh] items-center justify-center bg-slate-100 text-sm text-slate-500">
        Aucun fichier document attaché.
      </div>
    )
  }

  if (!isPdf) {
    return (
      <div className="bg-slate-200 px-4 py-6">
        <div className="mx-auto flex max-w-4xl flex-col items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white p-10 text-center shadow-sm">
          <FileText className="h-10 w-10 text-slate-300" />
          <p className="text-sm font-bold text-slate-800">{title}</p>
          <p className="text-xs text-slate-500">
            Aperçu intégré non disponible pour le format {format || 'fichier'}.
          </p>
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-[#243491] px-4 py-2 text-xs font-bold text-white hover:bg-[#1c2975]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Télécharger / Ouvrir
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-200 px-4 py-6">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
        {loading && (
          <div className="flex h-[70vh] items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-[#243491]" />
            Chargement du document…
          </div>
        )}

        {!loading && blobUrl && (
          <iframe
            title={title}
            src={blobUrl}
            className="h-[70vh] w-full border-0"
          />
        )}

        {!loading && !blobUrl && (
          <div className="flex h-[40vh] flex-col items-center justify-center gap-3 p-8 text-center">
            <FileText className="h-10 w-10 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">
              {error || 'Aperçu indisponible'}
            </p>
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-[#243491] px-4 py-2 text-xs font-bold text-white hover:bg-[#1c2975]"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Ouvrir le PDF
            </a>
          </div>
        )}
      </div>

      <div className="mt-3 text-center">
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#243491]"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Ouvrir dans un nouvel onglet
        </a>
      </div>
    </div>
  )
}
