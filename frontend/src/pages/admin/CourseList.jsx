import { useEffect, useMemo, useState } from 'react'
import CourseDetail from './CourseDetail'
import {
  Plus,
  Search,
  Filter,
  BookOpen,
  Layers,
  Edit3,
  Trash2,
  Eye,
  Users,
  CheckCircle2,
  Clock,
  Archive,
  FileText,
  X,
  Sparkles,
  ShieldCheck,
} from 'lucide-react'
import {
  createParcours,
  deleteParcours,
  getParcours,
  listParcours,
  updateParcours,
} from '../../api/courses.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { resolveBackendUrl } from '../../utils/courseHelpers.js'

const PROFIL_LABELS = {
  EDUCATEUR: 'Éducateur',
  FORCES_ORDRE: "Forces de l'ordre",
  MAGISTRAT: 'Magistrat',
  ASSISTANT_SOCIAL: 'Assistant social',
  AUTRE: 'Autre',
}

const EMPTY_FORM = {
  titre: '',
  description: '',
  profil_cible: 'EDUCATEUR',
  statut: 'BROUILLON',
  image: null,
  imagePreview: '',
}

const formatDate = (value) => {
  if (!value) {
    return '—'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

const normalizeCourse = (course) => ({
  id: course.id,
  titre: course.titre,
  description: course.description || 'Aucune description fournie.',
  profil_cible: course.profil_cible,
  profil_cible_label:
    course.profil_cible_display || PROFIL_LABELS[course.profil_cible] || course.profil_cible,
  statut: course.statut,
  formateur_id: course.formateur || null,
  formateur: course.publie_par || course.formateur_nom || 'Équipe pédagogique',
  formateur_role: course.formateur_role || null,
  publie_par: course.publie_par || course.formateur_nom || 'Équipe pédagogique',
  image: course.image || null,
  ordre: course.ordre,
  modules_count: course.nombre_modules ?? course.modules_count ?? course.modules?.length ?? 0,
  lecons_count:
    course.nombre_lecons ?? course.lecons_count ?? course.modules?.reduce((acc, module) => acc + (module.lecons?.length || 0), 0) ?? 0,
  date_creation: formatDate(course.date_creation),
  modules: course.modules,
})

const buildParcoursFormData = (formData, { includeStatut = false } = {}) => {
  const payload = new FormData()
  payload.append('titre', formData.titre)
  payload.append('description', formData.description || '')
  payload.append('profil_cible', formData.profil_cible)
  if (includeStatut) {
    payload.append('statut', formData.statut)
  } else {
    payload.append('statut', 'BROUILLON')
  }
  if (formData.image instanceof File) {
    payload.append('image', formData.image)
  }
  return payload
}

export default function CourseList({
  pageTitle = 'Gestion des Parcours',
  pageSubtitle = "Gérez les parcours d'apprentissage, modules et contenus pédagogiques.",
  createButtonLabel = 'Créer un parcours',
  /** Si true, n'affiche que les parcours dont l'utilisateur est le formateur (Course Builder). */
  ownOnly = false,
  /** Mode admin : consultation + changement de statut, sans création ni édition de contenu. */
  moderateOnly = false,
}) {
  const { user } = useAuth()
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [editingCourse, setEditingCourse] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [profileFilter, setProfileFilter] = useState('ALL')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('CREATE')
  const [editingCourseId, setEditingCourseId] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState(EMPTY_FORM)

  useEffect(() => {
    const loadCourses = async () => {
      try {
        setLoading(true)
        setError('')
        const data = await listParcours()
        let normalized = Array.isArray(data) ? data.map(normalizeCourse) : []
        if (ownOnly && user?.id && user?.role === 'FORMATEUR') {
          normalized = normalized.filter(
            (course) => !course.formateur_id || String(course.formateur_id) === String(user.id)
          )
        }
        setCourses(normalized)
      } catch {
        setError('Impossible de charger les parcours depuis le backend Django.')
      } finally {
        setLoading(false)
      }
    }

    loadCourses()
  }, [ownOnly, user?.id, user?.role])

  const refreshCourseDetails = async (courseId) => {
    const data = await getParcours(courseId)
    const normalized = normalizeCourse(data)
    setCourses((currentCourses) =>
      currentCourses.map((course) => (course.id === courseId ? normalized : course))
    )
    return normalized
  }

  const handleBackFromDetail = () => {
    setSelectedCourse(null)
  }

  const handleOpenCourse = async (course) => {
    try {
      const detailedCourse = course.modules ? course : await refreshCourseDetails(course.id)
      setSelectedCourse(detailedCourse)
    } catch {
      setSelectedCourse(course)
    }
  }

  const getStatusBadge = (statut) => {
    switch (statut) {
      case 'PUBLIE':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-3 w-3" /> Publié
          </span>
        )
      case 'BROUILLON':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
            <Clock className="h-3 w-3" /> Brouillon
          </span>
        )
      case 'ARCHIVE':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
            <Archive className="h-3 w-3" /> Archivé
          </span>
        )
      default:
        return null
    }
  }

  const handleCreateParcours = async (e) => {
    e.preventDefault()
    if (!formData.titre.trim()) {
      return
    }

    try {
      setIsSubmitting(true)
      const payload = buildParcoursFormData(formData, { includeStatut: false })

      const createdCourse = await createParcours(payload)
      setCourses((currentCourses) => [normalizeCourse(createdCourse), ...currentCourses])
      setIsModalOpen(false)
      setModalMode('CREATE')
      setEditingCourseId(null)
      setEditingCourse(null)
      setFormData(EMPTY_FORM)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateParcours = async (e) => {
    e.preventDefault()
    if (!editingCourseId || !formData.titre.trim()) {
      return
    }

    if (formData.statut === 'PUBLIE' && (editingCourse?.modules_count || 0) === 0) {
      setError('Vous devez ajouter au moins un module avant de publier ce parcours.')
      return
    }

    try {
      setIsSubmitting(true)
      setError('')
      const payload = buildParcoursFormData(formData, { includeStatut: true })

      const updatedCourse = await updateParcours(editingCourseId, payload)
      setCourses((currentCourses) =>
        currentCourses.map((course) =>
          course.id === editingCourseId ? normalizeCourse(updatedCourse) : course
        )
      )
      setIsModalOpen(false)
      setModalMode('CREATE')
      setEditingCourseId(null)
      setEditingCourse(null)
      setFormData(EMPTY_FORM)
    } catch (requestError) {
      const data = requestError?.response?.data
      const statutErrors = data?.statut
      if (Array.isArray(statutErrors) && statutErrors.length) {
        setError(statutErrors.join(' '))
      } else if (typeof statutErrors === 'string') {
        setError(statutErrors)
      } else if (data?.detail) {
        setError(data.detail)
      } else if (typeof data === 'object' && data) {
        const messages = Object.values(data)
          .flat()
          .filter(Boolean)
          .map(String)
        setError(messages.join(' ') || 'Impossible de mettre à jour le parcours.')
      } else {
        setError('Impossible de mettre à jour le parcours.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenEditParcours = (course) => {
    setModalMode('EDIT')
    setEditingCourseId(course.id)
    setEditingCourse(course)
    setFormData({
      titre: course.titre,
      description: course.description || '',
      profil_cible: course.profil_cible,
      statut: course.statut,
      image: null,
      imagePreview: course.image || '',
    })
    setIsModalOpen(true)
  }

  const handleDeleteCourse = async (courseId) => {
    await deleteParcours(courseId)
    setCourses((currentCourses) => currentCourses.filter((course) => course.id !== courseId))
  }

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const matchesSearch = course.titre.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === 'ALL' || course.statut === statusFilter
      const matchesProfile = profileFilter === 'ALL' || course.profil_cible === profileFilter
      return matchesSearch && matchesStatus && matchesProfile
    })
  }, [courses, searchTerm, statusFilter, profileFilter])

  if (selectedCourse) {
    return (
      <CourseDetail
        course={selectedCourse}
        onBack={handleBackFromDetail}
        readOnly={moderateOnly}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{pageTitle}</h1>
          <p className="text-xs font-medium text-slate-500">{pageSubtitle}</p>
        </div>

        {!moderateOnly && (
          <button
            onClick={() => {
              setModalMode('CREATE')
              setEditingCourseId(null)
              setEditingCourse(null)
              setFormData(EMPTY_FORM)
              setIsModalOpen(true)
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#243491] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1c2975] active:bg-[#15205c]"
          >
            <Plus className="h-4 w-4" />
            <span>{createButtonLabel}</span>
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-[#243491]">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Total Parcours</p>
            <p className="text-lg font-bold text-slate-900">{courses.length}</p>
          </div>
        </div>

        <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Publiés</p>
            <p className="text-lg font-bold text-slate-900">
              {courses.filter((course) => course.statut === 'PUBLIE').length}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Brouillons</p>
            <p className="text-lg font-bold text-slate-900">
              {courses.filter((course) => course.statut === 'BROUILLON').length}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Total Modules</p>
            <p className="text-lg font-bold text-slate-900">
              {courses.reduce((accumulator, currentCourse) => accumulator + currentCourse.modules_count, 0)}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher un parcours par titre..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-10 pr-4 text-xs font-medium text-slate-800 placeholder-slate-400 outline-none transition-colors focus:border-[#243491] focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-semibold text-slate-600">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="bg-transparent outline-none"
            >
              <option value="ALL">Tous les statuts</option>
              <option value="PUBLIE">Publié</option>
              <option value="BROUILLON">Brouillon</option>
              <option value="ARCHIVE">Archivé</option>
            </select>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-semibold text-slate-600">
            <Users className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={profileFilter}
              onChange={(event) => setProfileFilter(event.target.value)}
              className="bg-transparent outline-none"
            >
              <option value="ALL">Tous les profils</option>
              <option value="EDUCATEUR">Éducateur</option>
              <option value="FORCES_ORDRE">Forces de l'ordre</option>
              <option value="MAGISTRAT">Magistrat</option>
              <option value="ASSISTANT_SOCIAL">Assistant social</option>
              <option value="AUTRE">Autre</option>
            </select>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 text-sm font-medium text-slate-500">
          Chargement des parcours...
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {filteredCourses.map((course) => (
            <div
              key={course.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 transition-all hover:border-[#243491]/40 hover:shadow-xs"
            >
              <div>
                <div className="mb-3 overflow-hidden rounded-xl bg-slate-100">
                  {course.image ? (
                    <img
                      src={resolveBackendUrl(course.image)}
                      alt=""
                      className="h-36 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-28 items-center justify-center text-slate-300">
                      <BookOpen className="h-8 w-8" />
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 pb-3">
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                    {course.profil_cible_label}
                  </span>
                  {getStatusBadge(course.statut)}
                </div>

                <h3
                  onClick={() => handleOpenCourse(course)}
                  className="cursor-pointer text-base font-bold leading-snug text-slate-900 hover:text-[#243491]"
                >
                  {course.titre}
                </h3>
                <p className="mt-2 line-clamp-2 text-xs font-medium leading-relaxed text-slate-500">
                  {course.description}
                </p>
              </div>

              <div className="mt-6 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                      <Layers className="h-3.5 w-3.5 text-slate-400" />
                      {course.modules_count} Modules
                    </span>
                    <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                      <FileText className="h-3.5 w-3.5 text-slate-400" />
                      {course.lecons_count} Leçons
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">Créé : {course.date_creation}</span>
                </div>

                <div className="mt-4 flex items-center justify-between pt-2">
                  <span className="text-xs font-medium text-slate-400">
                    {course.publie_par || `Par ${course.formateur}`}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenCourse(course)}
                      title="Voir les détails"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-[#243491] hover:text-[#243491]"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleOpenEditParcours(course)}
                      title={moderateOnly ? 'Modérer le statut' : 'Éditer le parcours'}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    >
                      {moderateOnly ? <ShieldCheck className="h-3.5 w-3.5" /> : <Edit3 className="h-3.5 w-3.5" />}
                    </button>
                    {!moderateOnly && (
                      <button
                        title="Supprimer"
                        onClick={() => handleDeleteCourse(course.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 transition-all">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-[#243491]">
                  {moderateOnly ? <ShieldCheck className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {moderateOnly
                      ? 'Modérer le parcours'
                      : modalMode === 'EDIT'
                        ? 'Modifier le parcours'
                        : 'Nouveau Parcours'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {moderateOnly
                      ? 'Validez, publiez ou archivez ce parcours.'
                      : modalMode === 'EDIT'
                        ? 'Mettez à jour les informations du parcours.'
                        : 'Renseignez les informations de base du parcours.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={modalMode === 'EDIT' ? handleUpdateParcours : handleCreateParcours} className="mt-5 space-y-4">
              {error ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                  {error}
                </div>
              ) : null}
              {moderateOnly ? (
                <>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-3">
                    <p className="text-xs font-bold text-slate-900">{formData.titre}</p>
                    <p className="mt-1 line-clamp-3 text-[11px] text-slate-500">
                      {formData.description || 'Aucune description.'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700">Statut de publication</label>
                    <select
                      value={formData.statut}
                      onChange={(event) => setFormData({ ...formData, statut: event.target.value })}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition-colors focus:border-[#243491]"
                    >
                      <option value="BROUILLON">Brouillon</option>
                      {(editingCourse?.modules_count || 0) > 0 ? (
                        <option value="PUBLIE">Publié</option>
                      ) : null}
                      <option value="ARCHIVE">Archivé</option>
                    </select>
                    {(editingCourse?.modules_count || 0) === 0 ? (
                      <p className="mt-1 text-[11px] font-medium text-amber-600">
                        Ce parcours n’a pas encore de module : publication impossible.
                      </p>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Titre du parcours <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Sensibilisation à la protection de la vie privée"
                  value={formData.titre}
                  onChange={(event) => setFormData({ ...formData, titre: event.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-medium text-slate-800 outline-none transition-colors focus:border-[#243491] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">Description</label>
                <textarea
                  rows={3}
                  placeholder="Brève description des objectifs pédagogiques..."
                  value={formData.description}
                  onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-medium text-slate-800 outline-none transition-colors focus:border-[#243491] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">Image de couverture</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null
                    setFormData({
                      ...formData,
                      image: file,
                      imagePreview: file ? URL.createObjectURL(file) : formData.imagePreview,
                    })
                  }}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white"
                />
                {(formData.imagePreview || formData.image) && (
                  <img
                    src={
                      formData.image instanceof File
                        ? formData.imagePreview
                        : resolveBackendUrl(formData.imagePreview)
                    }
                    alt=""
                    className="mt-2 h-28 w-full rounded-xl object-cover"
                  />
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700">Profil Cible</label>
                  <select
                    value={formData.profil_cible}
                    onChange={(event) => setFormData({ ...formData, profil_cible: event.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition-colors focus:border-[#243491] focus:bg-white"
                  >
                    <option value="EDUCATEUR">Éducateur</option>
                    <option value="FORCES_ORDRE">Forces de l'ordre</option>
                    <option value="MAGISTRAT">Magistrat</option>
                    <option value="ASSISTANT_SOCIAL">Assistant social</option>
                    <option value="AUTRE">Autre</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">Statut de publication</label>
                  <select
                    value={formData.statut}
                    onChange={(event) => setFormData({ ...formData, statut: event.target.value })}
                    disabled={modalMode !== 'EDIT'}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition-colors focus:border-[#243491] focus:bg-white"
                  >
                    <option value="BROUILLON">Brouillon</option>
                    {modalMode === 'EDIT' && (editingCourse?.modules_count || 0) > 0 ? (
                      <option value="PUBLIE">Publié</option>
                    ) : null}
                    {modalMode === 'EDIT' ? <option value="ARCHIVE">Archivé</option> : null}
                  </select>
                    {modalMode === 'EDIT' && (editingCourse?.modules_count || 0) === 0 ? (
                      <p className="mt-1 text-[11px] font-medium text-amber-600">
                        Ajoutez au moins un module avant de pouvoir publier ce parcours.
                      </p>
                    ) : null}
                </div>
              </div>
                </>
              )}

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#243491] px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1c2975] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting
                    ? moderateOnly || modalMode === 'EDIT'
                      ? 'Mise à jour...'
                      : 'Création...'
                    : moderateOnly
                      ? 'Enregistrer le statut'
                      : modalMode === 'EDIT'
                        ? 'Mettre à jour le parcours'
                        : 'Créer le parcours'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
