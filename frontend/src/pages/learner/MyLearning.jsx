import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  CheckCircle2,
  Heart,
  Loader2,
  PlayCircle,
  AlertCircle,
  Award,
} from 'lucide-react'
import { getMyLearning, toggleFavorite } from '../../api/progression.js'
import { resolveBackendUrl, isPublishedParcours } from '../../utils/courseHelpers.js'

const COVER_FALLBACKS = ['bg-indigo-50', 'bg-sky-50', 'bg-amber-50', 'bg-emerald-50', 'bg-rose-50']

function CourseCard({ item, index, onToggleFavorite, favoritingId, variant = 'enrolled' }) {
  const imageUrl = resolveBackendUrl(item.image)
  const pct = Math.round(item.pourcentage || 0)
  const isFavoriting = favoritingId === item.parcours_id
  const isCompleted = variant === 'completed' || item.est_termine

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5">
      <div className={`relative h-36 w-full overflow-hidden rounded-xl ${COVER_FALLBACKS[index % COVER_FALLBACKS.length]}`}>
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <BookOpen className="h-10 w-10 text-slate-300" />
          </div>
        )}
        {isCompleted ? (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-1 text-[10px] font-bold text-white">
            <CheckCircle2 className="h-3 w-3" /> Terminé
          </span>
        ) : null}
        <button
          type="button"
          disabled={isFavoriting}
          onClick={() => onToggleFavorite(item.parcours_id)}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-slate-400 transition hover:text-red-500 disabled:opacity-60"
          title={item.is_favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        >
          {isFavoriting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Heart className={`h-3.5 w-3.5 ${item.is_favorite ? 'fill-red-500 text-red-500' : ''}`} />
          )}
        </button>
      </div>

      <div className="mt-3 space-y-2">
        <h3 className="line-clamp-2 text-sm font-bold text-slate-900">{item.parcours_titre}</h3>
        <p className="text-xs font-medium text-slate-400">
          {item.publie_par || item.formateur_nom || 'Formateur EMC'}
        </p>

        {item.is_enrolled ? (
          <div className="flex items-center gap-2 pt-1">
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{
                  width: `${Math.min(100, Math.max(0, pct))}%`,
                  backgroundColor: isCompleted ? '#10B981' : 'var(--color-brand, #243491)',
                }}
              />
            </div>
            <span className="shrink-0 text-[11px] font-bold text-slate-500">{pct}%</span>
          </div>
        ) : null}

        {(item.total_quizzes > 0) ? (
          <p className="text-[11px] font-medium text-slate-400">
            Quiz : {item.quizzes_reussis || 0}/{item.total_quizzes} validé(s)
          </p>
        ) : null}

        <div className="flex gap-2 pt-1">
          {isCompleted ? (
            <Link
              to={`/courses/${item.parcours_id}`}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700"
            >
              <Award className="h-3.5 w-3.5" />
              Voir / Certificat
            </Link>
          ) : item.is_enrolled ? (
            <Link
              to={`/courses/${item.parcours_id}/learn`}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-xs font-bold text-white transition hover:bg-brand-hover"
            >
              <PlayCircle className="h-3.5 w-3.5" />
              Continuer
            </Link>
          ) : (
            <Link
              to={`/courses/${item.parcours_id}`}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Voir le parcours
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

export default function MyLearning() {
  const [tab, setTab] = useState('enrolled')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [favoritingId, setFavoritingId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await getMyLearning()
      setData(result)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Impossible de charger Mes formations.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleToggleFavorite = async (parcoursId) => {
    setFavoritingId(parcoursId)
    try {
      const result = await toggleFavorite(parcoursId)
      setData((current) => {
        if (!current) return current
        const patchItem = (item) =>
          item.parcours_id === parcoursId
            ? { ...item, is_favorite: result.is_favorite }
            : item

        let favorites = (current.favorites || []).map(patchItem)
        if (!result.is_favorite) {
          favorites = favorites.filter((item) => item.parcours_id !== parcoursId)
        }

        return {
          ...current,
          enrolled: (current.enrolled || []).map(patchItem),
          completed: (current.completed || []).map(patchItem),
          favorites,
          favorites_count: favorites.length,
        }
      })
    } finally {
      setFavoritingId(null)
    }
  }

  const enrolled = (data?.enrolled || []).filter(isPublishedParcours)
  const completed = (data?.completed || []).filter(isPublishedParcours)
  const favorites = (data?.favorites || []).filter(isPublishedParcours)
  const list =
    tab === 'enrolled' ? enrolled : tab === 'completed' ? completed : favorites

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Mes formations</h1>
        <p className="mt-1 text-sm text-slate-500">
          Parcours en cours, terminés et favoris.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setTab('enrolled')}
          className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-bold transition ${
            tab === 'enrolled'
              ? 'border-brand text-brand'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          Parcours inscrits
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px]">{enrolled.length}</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('completed')}
          className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-bold transition ${
            tab === 'completed'
              ? 'border-brand text-brand'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CheckCircle2 className="h-4 w-4" />
          Terminés
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px]">{completed.length}</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('favorites')}
          className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-bold transition ${
            tab === 'favorites'
              ? 'border-brand text-brand'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Heart className="h-4 w-4" />
          Favoris
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px]">{favorites.length}</span>
        </button>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
          {tab === 'enrolled' ? (
            <>
              <BookOpen className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-700">Aucun parcours en cours</p>
              <p className="mt-1 text-xs text-slate-400">Explorez le catalogue pour commencer.</p>
              <Link
                to="/browse"
                className="mt-4 inline-flex rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white"
              >
                Explorer les parcours
              </Link>
            </>
          ) : tab === 'completed' ? (
            <>
              <CheckCircle2 className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-700">Aucun parcours terminé</p>
              <p className="mt-1 text-xs text-slate-400">
                Terminez toutes les leçons et validez tous les quiz pour compléter un parcours.
              </p>
            </>
          ) : (
            <>
              <Heart className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-700">Aucun favori</p>
              <p className="mt-1 text-xs text-slate-400">
                Marquez des parcours avec le cœur pour les retrouver ici.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((item, index) => (
            <CourseCard
              key={item.parcours_id}
              item={item}
              index={index}
              onToggleFavorite={handleToggleFavorite}
              favoritingId={favoritingId}
              variant={tab}
            />
          ))}
        </div>
      )}
    </div>
  )
}
