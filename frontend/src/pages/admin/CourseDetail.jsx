import { useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ChevronLeft,
  Plus,
  Layers,
  FileText,
  Video,
  Package,
  Clock,
  ChevronDown,
  ChevronUp,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  X,
  HelpCircle,
  GripVertical,
  AlignLeft,
} from 'lucide-react'
import {
  buildLeconPayload,
  createLecon,
  createModule,
  deleteLecon,
  deleteModule,
  getParcours,
  reorderLecons,
  reorderModules,
  updateLecon,
  updateModule,
} from '../../api/courses.js'
import { deleteQuiz } from '../../api/quizzes.js'
import QuizEditor from '../../components/instructor/QuizEditor.jsx'
import { resolveBackendUrl } from '../../utils/courseHelpers.js'

const normalizeContenu = (contenu) => {
  if (!contenu) {
    return null
  }

  const details = contenu.details || {}
  const type = contenu.type_contenu

  if (type === 'TEXTE' || details.type === 'TEXTE') {
    return {
      id: details.id || contenu.id,
      type: 'TEXTE',
      corps: details.corps || contenu.corps || '',
      titre_fichier: details.titre_fichier || contenu.titre_fichier || '',
    }
  }

  if (type === 'DOCUMENT' || details.type === 'DOCUMENT') {
    return {
      id: details.id || contenu.id,
      type: 'DOCUMENT',
      titre_fichier: details.titre_fichier || contenu.titre_fichier || '',
      format: details.format || 'PDF',
      fichier: details.fichier || '',
    }
  }

  if (type === 'VIDEO' || details.type === 'VIDEO') {
    const stream = details.url_stream || ''
    const source = details.fichier_source || ''
    const streamUsable = stream && !/\.m3u8($|\?)/i.test(stream)
    return {
      id: details.id || contenu.id,
      type: 'VIDEO',
      titre_fichier: details.titre_fichier || contenu.titre_fichier || '',
      statut_encodage: details.statut_encodage || 'PRET',
      url_stream: streamUsable ? stream : source || stream,
      fichier_source: source,
    }
  }

  if (type === 'SCORM' || details.type === 'SCORM') {
    return {
      id: details.id || contenu.id,
      type: 'SCORM',
      titre_fichier: details.titre_fichier || contenu.titre_fichier || '',
      standard: details.standard || 'SCORM 1.2',
      version: details.version || '1.2',
      launch_path_url: details.launch_path_url || '',
    }
  }

  return null
}

const normalizeQuiz = (quiz) => ({
  id: quiz.id,
  titre: quiz.titre,
  description: quiz.description || '',
  note_de_passage: quiz.note_de_passage ?? 80,
  duree_minutes: quiz.duree_minutes ?? 30,
  max_tentatives: quiz.max_tentatives ?? 3,
  questions_count: quiz.questions_count ?? quiz.questions?.length ?? 0,
  lecon: quiz.lecon || null,
})

const normalizeLecon = (lecon) => ({
  id: lecon.id,
  titre: lecon.titre,
  duree_estimee: lecon.duree_estimee,
  ordre: lecon.ordre,
  contenu: normalizeContenu(lecon.contenu),
})

const normalizeModule = (module) => ({
  id: module.id,
  titre: module.titre,
  description: module.description || '',
  ordre: module.ordre,
  lecons: (module.lecons || []).map(normalizeLecon),
  quizzes: (module.quizzes || []).map(normalizeQuiz),
})

const sortByOrdre = (items = []) =>
  [...items].sort((a, b) => (a.ordre || 0) - (b.ordre || 0))

const EMPTY_MODULE_FORM = {
  titre: '',
  description: '',
  ordre: 1,
}

const EMPTY_LECON_FORM = {
  titre: '',
  duree_estimee: 15,
  ordre: 1,
  contenuType: 'TEXTE',
  corps: '',
  titre_fichier: '',
  format: 'PDF',
  standard: 'SCORM 1.2',
  version: '1.2',
  launch_path_url: '',
  contenu_fichier: null,
  contenu_video_source: null,
  contenu_package_url: null,
}

const CONTENT_UPLOAD_CONFIG = {
  DOCUMENT: {
    field: 'contenu_fichier',
    accept: '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.odt',
    label: 'Glissez-déposez un document',
    helper: 'PDF, DOCX, PPTX, XLSX, TXT et autres documents de cours.',
  },
  VIDEO: {
    field: 'contenu_video_source',
    accept: 'video/*',
    label: 'Glissez-déposez une vidéo',
    helper: 'MP4, MOV, WEBM ou autre fichier vidéo source.',
  },
  SCORM: {
    field: 'contenu_package_url',
    accept: '.zip,application/zip',
    label: 'Glissez-déposez un package SCORM',
    helper: 'Archive ZIP du module interactif.',
  },
}

function SortableModule({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `module-${id}`,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      {children({
        dragHandleProps: { ...attributes, ...listeners },
      })}
    </div>
  )
}

function SortableLecon({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `lecon-${id}`,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      {children({
        dragHandleProps: { ...attributes, ...listeners },
      })}
    </div>
  )
}

export default function CourseDetail({ course, onBack, readOnly = false }) {
  const [modules, setModules] = useState(course?.modules ? course.modules.map(normalizeModule) : [])
  const [expandedModules, setExpandedModules] = useState([])
  const [loading, setLoading] = useState(Boolean(course?.id))
  const [error, setError] = useState('')
  const [moduleModal, setModuleModal] = useState({
    isOpen: false,
    mode: 'CREATE',
    data: null,
  })
  const [leconModal, setLeconModal] = useState({
    isOpen: false,
    mode: 'CREATE',
    moduleId: null,
    data: null,
  })
  const [deleteConfirm, setDeleteConfirm] = useState({
    isOpen: false,
    type: null,
    targetId: null,
    parentModuleId: null,
    title: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [isContentDragActive, setIsContentDragActive] = useState(false)
  const [previewModal, setPreviewModal] = useState({
    isOpen: false,
    title: '',
    kind: '',
    src: '',
  })
  const [quizEditor, setQuizEditor] = useState({
    isOpen: false,
    moduleId: null,
    moduleTitre: '',
    quizId: null,
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    const loadCourse = async () => {
      if (!course?.id) {
        setModules([])
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError('')
        const detail = course.modules ? course : await getParcours(course.id)
        const normalizedModules = sortByOrdre((detail.modules || []).map(normalizeModule)).map(
          (module) => ({
            ...module,
            lecons: sortByOrdre(module.lecons),
          })
        )
        setModules(normalizedModules)
        setExpandedModules(normalizedModules.map((module) => module.id))
      } catch {
        setError('Impossible de charger la structure du parcours depuis le backend.')
      } finally {
        setLoading(false)
      }
    }

    loadCourse()
  }, [course?.id])

  const sortedModules = useMemo(() => sortByOrdre(modules), [modules])

  const totalLecons = useMemo(
    () => modules.reduce((accumulator, module) => accumulator + (module.lecons?.length || 0), 0),
    [modules]
  )
  const totalQuizzes = useMemo(
    () => modules.reduce((acc, module) => acc + (module.quizzes?.length || 0), 0),
    [modules]
  )

  const openQuizEditor = (module, quiz = null) => {
    setQuizEditor({
      isOpen: true,
      moduleId: module.id,
      moduleTitre: module.titre,
      quizId: quiz?.id || null,
    })
  }

  const handleQuizSaved = (detail) => {
    const normalized = normalizeQuiz(detail)
    setModules((currentModules) =>
      currentModules.map((module) => {
        if (module.id !== quizEditor.moduleId) return module
        const existing = module.quizzes || []
        const found = existing.some((q) => q.id === normalized.id)
        return {
          ...module,
          quizzes: found
            ? existing.map((q) => (q.id === normalized.id ? normalized : q))
            : [...existing, normalized],
        }
      })
    )
  }

  const confirmDeleteQuiz = (moduleId, quiz) => {
    setDeleteConfirm({
      isOpen: true,
      type: 'QUIZ',
      targetId: quiz.id,
      parentModuleId: moduleId,
      title: quiz.titre,
    })
  }

  const toggleModule = (moduleId) => {
    setExpandedModules((prev) =>
      prev.includes(moduleId) ? prev.filter((id) => id !== moduleId) : [...prev, moduleId]
    )
  }

  const openCreateModuleModal = () => {
    setModuleModal({
      isOpen: true,
      mode: 'CREATE',
      data: { ...EMPTY_MODULE_FORM, ordre: modules.length + 1 },
    })
  }

  const openEditModuleModal = (module) => {
    setModuleModal({
      isOpen: true,
      mode: 'EDIT',
      data: { ...module },
    })
  }

  const handleSaveModule = async (event) => {
    event.preventDefault()
    setSubmitting(true)

    try {
      if (moduleModal.mode === 'CREATE') {
        const created = await createModule({
          parcours: course.id,
          titre: moduleModal.data.titre,
          description: moduleModal.data.description,
          ordre: Number(moduleModal.data.ordre) || modules.length + 1,
        })
        const normalized = normalizeModule({ ...created, lecons: [], quizzes: [] })
        setModules((currentModules) => [...currentModules, normalized])
        setExpandedModules((currentModules) => [...currentModules, normalized.id])
      } else {
        const updated = await updateModule(moduleModal.data.id, {
          parcours: course.id,
          titre: moduleModal.data.titre,
          description: moduleModal.data.description,
          ordre: Number(moduleModal.data.ordre),
        })
        const normalized = normalizeModule({
          ...updated,
          lecons: moduleModal.data.lecons || [],
          quizzes: moduleModal.data.quizzes || [],
        })
        setModules((currentModules) =>
          currentModules.map((module) => (module.id === normalized.id ? normalized : module))
        )
      }
      setModuleModal({ isOpen: false, mode: 'CREATE', data: null })
    } finally {
      setSubmitting(false)
    }
  }

  const confirmDeleteModule = (module) => {
    setDeleteConfirm({
      isOpen: true,
      type: 'MODULE',
      targetId: module.id,
      title: module.titre,
    })
  }

  const openCreateLeconModal = (moduleId) => {
    const parentModule = modules.find((module) => module.id === moduleId)
    setLeconModal({
      isOpen: true,
      mode: 'CREATE',
      moduleId,
      data: {
        ...EMPTY_LECON_FORM,
        ordre: (parentModule?.lecons?.length || 0) + 1,
      },
    })
  }

  const openEditLeconModal = (moduleId, lecon) => {
    setLeconModal({
      isOpen: true,
      mode: 'EDIT',
      moduleId,
      data: {
        id: lecon.id,
        titre: lecon.titre,
        duree_estimee: lecon.duree_estimee,
        ordre: lecon.ordre,
        contenuType: lecon.contenu?.type || 'TEXTE',
        corps: lecon.contenu?.corps || '',
        titre_fichier: lecon.contenu?.titre_fichier || '',
        format: lecon.contenu?.format || 'PDF',
        standard: lecon.contenu?.standard || 'SCORM 1.2',
        version: lecon.contenu?.version || '1.2',
        launch_path_url: lecon.contenu?.launch_path_url || '',
        contenu_fichier: null,
        contenu_video_source: null,
        contenu_package_url: null,
      },
    })
  }

  const updateLeconContentFile = (file) => {
    if (!file) {
      return
    }

    const contentType = leconModal.data.contenuType
    const fileBaseName = file.name.replace(/\.[^.]+$/, '')

    setLeconModal((currentModal) => ({
      ...currentModal,
      data: {
        ...currentModal.data,
        titre_fichier: currentModal.data.titre_fichier || fileBaseName,
        ...(contentType === 'DOCUMENT'
          ? { format: file.name.split('.').pop()?.toUpperCase() || 'PDF', contenu_fichier: file }
          : {}),
        ...(contentType === 'VIDEO' ? { contenu_video_source: file } : {}),
        ...(contentType === 'SCORM' ? { contenu_package_url: file } : {}),
      },
    }))
  }

  const handleContentFileChange = (event) => {
    const selectedFile = event.target.files?.[0]
    updateLeconContentFile(selectedFile)
  }

  const handleContentDrop = (event) => {
    event.preventDefault()
    setIsContentDragActive(false)
    const droppedFile = event.dataTransfer.files?.[0]
    updateLeconContentFile(droppedFile)
  }

  const openContentPreview = (contenu) => {
    if (!contenu) {
      return
    }

    if (contenu.type === 'DOCUMENT') {
      const documentUrl = resolveBackendUrl(contenu.fichier)
      if (documentUrl) {
        window.open(documentUrl, '_blank', 'noopener,noreferrer')
      }
      return
    }

    if (contenu.type === 'VIDEO') {
      setPreviewModal({
        isOpen: true,
        title: contenu.titre_fichier || 'Vidéo',
        kind: 'VIDEO',
        src: resolveBackendUrl(contenu.url_stream),
      })
      return
    }

    if (contenu.type === 'SCORM') {
      setPreviewModal({
        isOpen: true,
        title: contenu.titre_fichier || 'SCORM',
        kind: 'SCORM',
        src: resolveBackendUrl(contenu.launch_path_url),
      })
    }
  }

  const handleSaveLecon = async (event) => {
    event.preventDefault()
    setSubmitting(true)

    try {
      const payload = buildLeconPayload(leconModal.data, leconModal.moduleId)
      if (leconModal.mode === 'CREATE') {
        const created = await createLecon(payload)
        const normalized = normalizeLecon(created)
        setModules((currentModules) =>
          currentModules.map((module) =>
            module.id === leconModal.moduleId
              ? { ...module, lecons: [...(module.lecons || []), normalized] }
              : module
          )
        )
      } else {
        const updated = await updateLecon(leconModal.data.id, payload)
        const normalized = normalizeLecon(updated)
        setModules((currentModules) =>
          currentModules.map((module) =>
            module.id === leconModal.moduleId
              ? {
                  ...module,
                  lecons: module.lecons.map((lecon) =>
                    lecon.id === normalized.id ? normalized : lecon
                  ),
                }
              : module
          )
        )
      }
      setLeconModal({ isOpen: false, mode: 'CREATE', moduleId: null, data: null })
    } finally {
      setSubmitting(false)
    }
  }

  const confirmDeleteLecon = (moduleId, lecon) => {
    setDeleteConfirm({
      isOpen: true,
      type: 'LECON',
      targetId: lecon.id,
      parentModuleId: moduleId,
      title: lecon.titre,
    })
  }

  const executeDelete = async () => {
    setSubmitting(true)

    try {
      if (deleteConfirm.type === 'MODULE') {
        await deleteModule(deleteConfirm.targetId)
        setModules((currentModules) => currentModules.filter((module) => module.id !== deleteConfirm.targetId))
      }

      if (deleteConfirm.type === 'LECON') {
        await deleteLecon(deleteConfirm.targetId)
        setModules((currentModules) =>
          currentModules.map((module) =>
            module.id === deleteConfirm.parentModuleId
              ? { ...module, lecons: module.lecons.filter((lecon) => lecon.id !== deleteConfirm.targetId) }
              : module
          )
        )
      }

      if (deleteConfirm.type === 'QUIZ') {
        await deleteQuiz(deleteConfirm.targetId)
        setModules((currentModules) =>
          currentModules.map((module) =>
            module.id === deleteConfirm.parentModuleId
              ? {
                  ...module,
                  quizzes: (module.quizzes || []).filter((quiz) => quiz.id !== deleteConfirm.targetId),
                }
              : module
          )
        )
      }

      setDeleteConfirm({ isOpen: false, type: null, targetId: null, parentModuleId: null, title: '' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleModuleDragEnd = async (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = sortedModules.findIndex((m) => `module-${m.id}` === active.id)
    const newIndex = sortedModules.findIndex((m) => `module-${m.id}` === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const reordered = arrayMove(sortedModules, oldIndex, newIndex).map((module, index) => ({
      ...module,
      ordre: index + 1,
    }))
    setModules(reordered)

    try {
      await reorderModules(reordered.map((module) => ({ id: module.id, ordre: module.ordre })))
    } catch {
      setError('Impossible de réordonner les modules.')
    }
  }

  const handleLeconDragEnd = async (moduleId, event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const parentModule = modules.find((module) => module.id === moduleId)
    if (!parentModule) return

    const lecons = sortByOrdre(parentModule.lecons || [])
    const oldIndex = lecons.findIndex((lecon) => `lecon-${lecon.id}` === active.id)
    const newIndex = lecons.findIndex((lecon) => `lecon-${lecon.id}` === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const reordered = arrayMove(lecons, oldIndex, newIndex).map((lecon, index) => ({
      ...lecon,
      ordre: index + 1,
    }))

    setModules((currentModules) =>
      currentModules.map((module) =>
        module.id === moduleId ? { ...module, lecons: reordered } : module
      )
    )

    try {
      await reorderLecons(reordered.map((lecon) => ({ id: lecon.id, ordre: lecon.ordre })))
    } catch {
      setError('Impossible de réordonner les leçons.')
    }
  }

  const renderContenuBadge = (contenu) => {
    if (!contenu) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600">
          <AlertCircle className="h-3.5 w-3.5" /> Aucun contenu attaché
        </span>
      )
    }

    switch (contenu.type) {
      case 'TEXTE':
        return (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-bold text-slate-700">
              <AlignLeft className="h-3.5 w-3.5" /> Texte
            </span>
            <span className="line-clamp-1 font-medium text-slate-500">
              {contenu.corps ? `${contenu.corps.slice(0, 80)}${contenu.corps.length > 80 ? '…' : ''}` : 'Texte simple'}
            </span>
          </div>
        )
      case 'DOCUMENT':
        return (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 font-bold text-blue-700">
              <FileText className="h-3.5 w-3.5" /> {contenu.format || 'PDF'}
            </span>
            <button
              type="button"
              onClick={() => openContentPreview(contenu)}
              className="font-medium text-slate-700 hover:text-[#243491] hover:underline"
            >
              {contenu.titre_fichier}
            </button>
          </div>
        )
      case 'VIDEO':
        return (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 font-bold text-purple-700">
              <Video className="h-3.5 w-3.5" /> Vidéo
            </span>
            <button
              type="button"
              onClick={() => openContentPreview(contenu)}
              className="font-medium text-slate-700 hover:text-[#243491] hover:underline"
            >
              {contenu.titre_fichier}
            </button>
            {contenu.statut_encodage === 'PRET' ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                <CheckCircle2 className="h-3 w-3" /> Prêt
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                <Clock className="h-3 w-3" /> Encodage...
              </span>
            )}
          </div>
        )
      case 'SCORM':
        return (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 font-bold text-amber-700">
              <Package className="h-3.5 w-3.5" /> {contenu.standard || 'SCORM'}
            </span>
            <button
              type="button"
              onClick={() => openContentPreview(contenu)}
              className="font-medium text-slate-700 hover:text-[#243491] hover:underline"
            >
              {contenu.titre_fichier}
            </button>
            {contenu.launch_path_url ? (
              <button
                type="button"
                onClick={() => openContentPreview(contenu)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#243491] hover:underline"
              >
                Lancer <ExternalLink className="h-3 w-3" />
              </button>
            ) : null}
          </div>
        )
      default:
        return null
    }
  }

  const showFileUpload = ['DOCUMENT', 'VIDEO', 'SCORM'].includes(leconModal.data?.contenuType)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Retour aux parcours</span>
        </button>

        {!readOnly && (
          <div className="flex items-center gap-2">
            <button
              onClick={openCreateModuleModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#243491] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1c2975]"
            >
              <Plus className="h-3.5 w-3.5" /> Ajouter un Module
            </button>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-6">
        <div className="flex items-center justify-between gap-4 pb-3">
          <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-[#243491]">
            Profil Cible : {course?.profil_cible_label || course?.profil_cible || 'Éducateur'}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-3 w-3" /> {course?.statut || 'PUBLIE'}
          </span>
        </div>

        <h1 className="text-xl font-bold text-slate-900">{course?.titre || 'Titre du Parcours'}</h1>
        <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500">
          {course?.description || 'Aucune description disponible.'}
        </p>

        <div className="mt-4 flex items-center gap-6 border-t border-slate-100 pt-4 text-xs font-semibold text-slate-500">
          <span className="flex items-center gap-1.5">
            <Layers className="h-4 w-4 text-slate-400" /> {modules.length} Modules
          </span>
          <span className="flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-slate-400" /> {totalLecons} Leçons
          </span>
          <span className="flex items-center gap-1.5">
            <HelpCircle className="h-4 w-4 text-slate-400" /> {totalQuizzes} Quiz
          </span>
          <span className="text-slate-400">
            Formateur :{' '}
            <span className="text-slate-700">
              {course?.publie_par || course?.formateur || 'Équipe pédagogique'}
            </span>
          </span>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
          {error}
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Structure du Parcours</h2>
          {!readOnly && (
            <span className="text-xs font-medium text-slate-400">Glissez pour réordonner</span>
          )}
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 text-sm font-medium text-slate-500">
            Chargement de la structure du parcours...
          </div>
        ) : sortedModules.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <Layers className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-xs font-bold text-slate-700">Aucun module dans ce parcours</p>
            <p className="text-[11px] text-slate-400">
              {readOnly
                ? 'Le formateur n’a pas encore ajouté de contenu.'
                : 'Commencez par ajouter votre premier module ci-dessus.'}
            </p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleModuleDragEnd}>
            <SortableContext
              items={sortedModules.map((module) => `module-${module.id}`)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-4">
                {sortedModules.map((module) => {
                  const isExpanded = expandedModules.includes(module.id)
                  const sortedLecons = sortByOrdre(module.lecons || [])

                  return (
                    <SortableModule key={module.id} id={module.id}>
                      {({ dragHandleProps }) => (
                        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white transition-all">
                          <div
                            onClick={() => toggleModule(module.id)}
                            className="flex cursor-pointer items-center justify-between bg-slate-50/70 p-4 transition-colors hover:bg-slate-100/60"
                          >
                            <div className="flex items-center gap-3">
                              {!readOnly && (
                                <button
                                  type="button"
                                  {...dragHandleProps}
                                  onClick={(event) => event.stopPropagation()}
                                  className="flex h-8 w-8 cursor-grab items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-slate-600 active:cursor-grabbing"
                                  title="Réordonner le module"
                                >
                                  <GripVertical className="h-4 w-4" />
                                </button>
                              )}
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#243491] text-xs font-bold text-white">
                                M{module.ordre}
                              </div>
                              <div>
                                <h3 className="text-sm font-bold text-slate-900">{module.titre}</h3>
                                <p className="text-xs font-medium text-slate-400">{module.description}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {!readOnly && (
                                <>
                                  <button
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      openCreateLeconModal(module.id)
                                    }}
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                                  >
                                    <Plus className="h-3 w-3" /> Ajouter Leçon
                                  </button>

                                  <button
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      openQuizEditor(module)
                                    }}
                                    className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100"
                                  >
                                    <HelpCircle className="h-3 w-3" /> Quiz
                                  </button>

                                  <button
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      openEditModuleModal(module)
                                    }}
                                    title="Modifier le module"
                                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                                  >
                                    <Edit3 className="h-3.5 w-3.5" />
                                  </button>

                                  <button
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      confirmDeleteModule(module)
                                    }}
                                    title="Supprimer le module"
                                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}

                              <button className="ml-1 text-slate-400 hover:text-slate-600">
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>

                          {isExpanded ? (
                            <div className="divide-y divide-slate-100 p-2">
                              {sortedLecons.length === 0 ? (
                                <div className="p-4 text-center text-xs font-medium text-slate-400">
                                  Aucune leçon enregistrée dans ce module.
                                </div>
                              ) : (
                                <DndContext
                                  sensors={sensors}
                                  collisionDetection={closestCenter}
                                  onDragEnd={(event) => handleLeconDragEnd(module.id, event)}
                                >
                                  <SortableContext
                                    items={sortedLecons.map((lecon) => `lecon-${lecon.id}`)}
                                    strategy={verticalListSortingStrategy}
                                  >
                                    {sortedLecons.map((lecon) => (
                                      <SortableLecon key={lecon.id} id={lecon.id}>
                                        {({ dragHandleProps }) => (
                                          <div className="flex flex-col gap-3 p-3 transition-colors hover:bg-slate-50/50 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="flex items-start gap-2">
                                              {!readOnly && (
                                                <button
                                                  type="button"
                                                  {...dragHandleProps}
                                                  className="mt-0.5 flex h-7 w-7 cursor-grab items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-slate-600 active:cursor-grabbing"
                                                  title="Réordonner la leçon"
                                                >
                                                  <GripVertical className="h-3.5 w-3.5" />
                                                </button>
                                              )}
                                              <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                  <span className="text-xs font-bold text-slate-800">{lecon.titre}</span>
                                                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                                                    <Clock className="h-3 w-3" /> {lecon.duree_estimee} min
                                                  </span>
                                                </div>
                                                <div className="pt-1">{renderContenuBadge(lecon.contenu)}</div>
                                              </div>
                                            </div>

                                            {!readOnly && (
                                              <div className="flex items-center gap-1 self-end sm:self-center">
                                                <button
                                                  onClick={() => openEditLeconModal(module.id, lecon)}
                                                  title="Modifier la leçon"
                                                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                                                >
                                                  <Edit3 className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                  onClick={() => confirmDeleteLecon(module.id, lecon)}
                                                  title="Supprimer la leçon"
                                                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                                                >
                                                  <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </SortableLecon>
                                    ))}
                                  </SortableContext>
                                </DndContext>
                              )}

                              <div className="border-t border-dashed border-amber-200 bg-amber-50/40 p-3">
                                <div className="mb-2 flex items-center justify-between">
                                  <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">
                                    Évaluation de fin de module
                                  </p>
                                  {!readOnly && (!module.quizzes || module.quizzes.length === 0) && (
                                    <button
                                      type="button"
                                      onClick={() => openQuizEditor(module)}
                                      className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-amber-700"
                                    >
                                      <Plus className="h-3 w-3" /> Créer un quiz
                                    </button>
                                  )}
                                </div>

                                {(!module.quizzes || module.quizzes.length === 0) ? (
                                  <p className="text-xs font-medium text-amber-800/70">
                                    Aucun questionnaire rattaché
                                    {readOnly
                                      ? '.'
                                      : '. Ajoutez un QCM/QCU pour valider ce module.'}
                                  </p>
                                ) : (
                                  <div className="space-y-2">
                                    {module.quizzes.map((quiz) => (
                                      <div
                                        key={quiz.id}
                                        className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                                      >
                                        <div>
                                          <div className="flex items-center gap-2">
                                            <HelpCircle className="h-4 w-4 text-amber-600" />
                                            <span className="text-xs font-bold text-slate-800">{quiz.titre}</span>
                                          </div>
                                          <p className="mt-1 text-[11px] font-medium text-slate-500">
                                            {quiz.questions_count} question(s) · Passage ≥ {quiz.note_de_passage}% ·{' '}
                                            {quiz.duree_minutes} min · {quiz.max_tentatives} tentative(s)
                                          </p>
                                        </div>
                                        {!readOnly && (
                                          <div className="flex items-center gap-1 self-end sm:self-center">
                                            <button
                                              type="button"
                                              onClick={() => openQuizEditor(module, quiz)}
                                              title="Modifier le quiz"
                                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                                            >
                                              <Edit3 className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => confirmDeleteQuiz(module.id, quiz)}
                                              title="Supprimer le quiz"
                                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                                            >
                                              <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                    {!readOnly && (
                                      <button
                                        type="button"
                                        onClick={() => openQuizEditor(module)}
                                        className="text-[11px] font-bold text-amber-700 hover:underline"
                                      >
                                        + Ajouter un autre quiz
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </SortableModule>
                  )
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {moduleModal.isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-[#243491]">
                  <Layers className="h-4 w-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900">
                  {moduleModal.mode === 'CREATE' ? 'Nouveau Module' : 'Modifier le Module'}
                </h2>
              </div>
              <button
                onClick={() => setModuleModal({ ...moduleModal, isOpen: false })}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveModule} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Titre du module <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Module 1 : Concepts fondamentaux"
                  value={moduleModal.data.titre}
                  onChange={(event) =>
                    setModuleModal({
                      ...moduleModal,
                      data: { ...moduleModal.data, titre: event.target.value },
                    })
                  }
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-medium text-slate-800 outline-none focus:border-[#243491] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">Description</label>
                <textarea
                  rows={3}
                  placeholder="Résumé des objectifs du module..."
                  value={moduleModal.data.description}
                  onChange={(event) =>
                    setModuleModal({
                      ...moduleModal,
                      data: { ...moduleModal.data, description: event.target.value },
                    })
                  }
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-medium text-slate-800 outline-none focus:border-[#243491] focus:bg-white"
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setModuleModal({ ...moduleModal, isOpen: false })}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-[#243491] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1c2975] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting
                    ? 'Enregistrement...'
                    : moduleModal.mode === 'CREATE'
                      ? 'Enregistrer le module'
                      : 'Mettre à jour'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {leconModal.isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-[#243491]">
                  <FileText className="h-4 w-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900">
                  {leconModal.mode === 'CREATE' ? 'Nouvelle Leçon' : 'Modifier la Leçon'}
                </h2>
              </div>
              <button
                onClick={() => setLeconModal({ ...leconModal, isOpen: false })}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLecon} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Titre de la leçon <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 1.1 Introduction aux menaces"
                  value={leconModal.data.titre}
                  onChange={(event) =>
                    setLeconModal({
                      ...leconModal,
                      data: { ...leconModal.data, titre: event.target.value },
                    })
                  }
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-medium text-slate-800 outline-none focus:border-[#243491] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">Durée estimée (minutes)</label>
                <input
                  type="number"
                  min="1"
                  value={leconModal.data.duree_estimee}
                  onChange={(event) =>
                    setLeconModal({
                      ...leconModal,
                      data: { ...leconModal.data, duree_estimee: event.target.value },
                    })
                  }
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-medium text-slate-800 outline-none focus:border-[#243491] focus:bg-white"
                />
              </div>

              <div className="border-t border-slate-100 pt-4">
                <label className="block text-xs font-bold text-slate-700">
                  Type de Contenu Pédagogique
                </label>
                <select
                  value={leconModal.data.contenuType}
                  onChange={(event) =>
                    setLeconModal({
                      ...leconModal,
                      data: { ...leconModal.data, contenuType: event.target.value },
                    })
                  }
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-[#243491] focus:bg-white"
                >
                  <option value="TEXTE">Texte simple</option>
                  <option value="DOCUMENT">Document Statique (PDF, DOCX)</option>
                  <option value="VIDEO">Vidéo</option>
                  <option value="SCORM">Module Interactif SCORM (Zip)</option>
                </select>
              </div>

              {leconModal.data.contenuType === 'TEXTE' ? (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-3.5">
                  <label className="block text-xs font-bold text-slate-700">Corps du texte</label>
                  <textarea
                    rows={8}
                    placeholder="Rédigez le contenu textuel de la leçon..."
                    value={leconModal.data.corps}
                    onChange={(event) =>
                      setLeconModal({
                        ...leconModal,
                        data: { ...leconModal.data, corps: event.target.value },
                      })
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 outline-none focus:border-[#243491]"
                  />
                </div>
              ) : null}

              {showFileUpload ? (
                <div className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/30 p-3.5">
                  <div
                    onDragOver={(event) => {
                      event.preventDefault()
                      setIsContentDragActive(true)
                    }}
                    onDragLeave={() => setIsContentDragActive(false)}
                    onDrop={handleContentDrop}
                    className={`rounded-xl border-2 border-dashed p-4 transition-colors ${
                      isContentDragActive ? 'border-[#243491] bg-white' : 'border-indigo-200 bg-white/70'
                    }`}
                  >
                    <input
                      id={`lecon-upload-${leconModal.mode}-${leconModal.moduleId}-${leconModal.data.contenuType}`}
                      type="file"
                      accept={CONTENT_UPLOAD_CONFIG[leconModal.data.contenuType]?.accept}
                      onChange={handleContentFileChange}
                      className="sr-only"
                    />
                    <label
                      htmlFor={`lecon-upload-${leconModal.mode}-${leconModal.moduleId}-${leconModal.data.contenuType}`}
                      className="flex cursor-pointer flex-col items-center justify-center gap-2 text-center"
                    >
                      <HelpCircle className="h-5 w-5 text-[#243491]" />
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          {CONTENT_UPLOAD_CONFIG[leconModal.data.contenuType]?.label}
                        </p>
                        <p className="text-[11px] font-medium text-slate-500">
                          Déposez le fichier depuis votre PC ou cliquez pour parcourir.
                        </p>
                      </div>
                    </label>

                    <p className="mt-3 text-[11px] font-medium text-slate-500">
                      {CONTENT_UPLOAD_CONFIG[leconModal.data.contenuType]?.helper}
                    </p>

                    {leconModal.data[CONTENT_UPLOAD_CONFIG[leconModal.data.contenuType]?.field] ? (
                      <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700">
                        Fichier sélectionné :{' '}
                        <span className="font-bold text-[#243491]">
                          {leconModal.data[CONTENT_UPLOAD_CONFIG[leconModal.data.contenuType]?.field]?.name}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {leconModal.data.contenuType === 'SCORM' ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-bold text-slate-700">Standard</label>
                        <input
                          type="text"
                          value={leconModal.data.standard}
                          onChange={(event) =>
                            setLeconModal({
                              ...leconModal,
                              data: { ...leconModal.data, standard: event.target.value },
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700">Version</label>
                        <input
                          type="text"
                          value={leconModal.data.version}
                          onChange={(event) =>
                            setLeconModal({
                              ...leconModal,
                              data: { ...leconModal.data, version: event.target.value },
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 outline-none"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setLeconModal({ ...leconModal, isOpen: false })}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-[#243491] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1c2975] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting
                    ? 'Enregistrement...'
                    : leconModal.mode === 'CREATE'
                      ? 'Enregistrer la leçon'
                      : 'Mettre à jour'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteConfirm.isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-3 text-red-600">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Confirmer la suppression</h3>
                <p className="text-xs text-slate-500">Cette action est irréversible.</p>
              </div>
            </div>

            <p className="mt-4 text-xs font-medium text-slate-600">
              Voulez-vous vraiment supprimer{' '}
              {deleteConfirm.type === 'MODULE'
                ? 'le module'
                : deleteConfirm.type === 'QUIZ'
                  ? 'le questionnaire'
                  : 'la leçon'}{' '}
              <span className="font-bold text-slate-900">"{deleteConfirm.title}"</span> ?
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm({ ...deleteConfirm, isOpen: false })}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={executeDelete}
                disabled={submitting}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Suppression...' : 'Supprimer définitivement'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {previewModal.isOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">{previewModal.title}</h3>
                <p className="text-xs font-medium text-slate-400">
                  Aperçu interne {previewModal.kind === 'SCORM' ? 'du module interactif' : 'du contenu'}
                </p>
              </div>
              <button
                onClick={() => setPreviewModal({ isOpen: false, title: '', kind: '', src: '' })}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 bg-slate-50 p-4">
              {previewModal.kind === 'VIDEO' ? (
                <video controls autoPlay className="h-full w-full rounded-xl bg-black" src={previewModal.src}>
                  Votre navigateur ne supporte pas la lecture vidéo intégrée.
                </video>
              ) : previewModal.kind === 'DOCUMENT' ? (
                <object
                  data={`${previewModal.src}#toolbar=1`}
                  type="application/pdf"
                  className="h-full w-full rounded-xl border border-slate-200 bg-white"
                >
                  <iframe
                    title={previewModal.title}
                    src={previewModal.src}
                    className="h-full w-full rounded-xl border border-slate-200 bg-white"
                  />
                </object>
              ) : (
                <iframe
                  title={previewModal.title}
                  src={previewModal.src}
                  className="h-full w-full rounded-xl border border-slate-200 bg-white"
                />
              )}
            </div>

            {previewModal.src ? (
              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs font-medium text-slate-500">
                <span>Si l&apos;aperçu échoue, ouvrez le fichier directement.</span>
                <a
                  href={previewModal.src}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-[#243491] hover:underline"
                >
                  Ouvrir / Télécharger →
                </a>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <QuizEditor
        isOpen={quizEditor.isOpen}
        moduleId={quizEditor.moduleId}
        moduleTitre={quizEditor.moduleTitre}
        quizId={quizEditor.quizId}
        onClose={() =>
          setQuizEditor({ isOpen: false, moduleId: null, moduleTitre: '', quizId: null })
        }
        onSaved={handleQuizSaved}
      />
    </div>
  )
}
