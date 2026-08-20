import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Search,
  Download,
  Plus,
  ArrowUpDown,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  UserPlus,
  ShieldCheck,
  GraduationCap,
  UserCheck,
} from 'lucide-react'
import { createUser, deleteUser, listUsers, updateUser } from '../../api/users.js'
import useAutoDismiss from '../../hooks/useAutoDismiss.js'

const EMPTY_FORM = {
  fullName: '',
  username: '',
  email: '',
  phone: '',
  role: 'FORMATEUR',
  status: 'Active',
  password: '',
  confirmPassword: '',
}

const formatDate = (value) => {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const splitFullName = (fullName) => {
  const normalizedName = fullName.trim().replace(/\s+/g, ' ')

  if (!normalizedName) {
    return { first_name: '', last_name: '' }
  }

  const parts = normalizedName.split(' ')

  if (parts.length === 1) {
    return { first_name: parts[0], last_name: '' }
  }

  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(' '),
  }
}

const normalizeUser = (user) => ({
  id: user.id,
  role: user.role || 'APPRENANT',
  fullName:
    `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || user.email || '',
  username: user.username || '',
  email: user.email || '',
  phone: user.telephone || '',
  dateCreated: formatDate(user.created_at),
  status: user.is_active ? 'Active' : 'Inactive',
})

export default function UserManagement() {
  const [users, setUsers] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selectedUsers, setSelectedUsers] = useState([])
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingUserId, setEditingUserId] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [userForm, setUserForm] = useState(EMPTY_FORM)
  const clearErrorMessage = useCallback(() => setErrorMessage(''), [])
  useAutoDismiss(errorMessage, clearErrorMessage)

  const loadUsers = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage('')

    try {
      const data = await listUsers()
      const payload = Array.isArray(data) ? data : data?.results || []
      setUsers(payload.map(normalizeUser))
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.detail ||
          'Impossible de charger les utilisateurs. Vérifiez votre session et vos permissions.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const filteredUsers = useMemo(
    () =>
      users.filter((user) => {
        const matchesSearch =
          user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
          user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          user.email.toLowerCase().includes(searchQuery.toLowerCase())

        const matchesRole = roleFilter === 'ALL' || user.role === roleFilter
        const matchesStatus = statusFilter === 'ALL' || user.status === statusFilter

        return matchesSearch && matchesRole && matchesStatus
      }),
    [roleFilter, searchQuery, statusFilter, users],
  )

  useEffect(() => {
    setSelectedUsers((currentSelectedUsers) =>
      currentSelectedUsers.filter((userId) => filteredUsers.some((user) => user.id === userId)),
    )
  }, [filteredUsers])

  const hasAnyUsers = users.length > 0

  const openCreateModal = () => {
    setEditingUserId(null)
    setUserForm(EMPTY_FORM)
    setIsAddModalOpen(true)
    setIsEditModalOpen(false)
    setErrorMessage('')
  }

  const openEditModal = (user) => {
    setEditingUserId(user.id)
    setUserForm({
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      password: '',
      confirmPassword: '',
    })
    setIsAddModalOpen(false)
    setIsEditModalOpen(true)
    setErrorMessage('')
  }

  const closeModal = () => {
    setIsAddModalOpen(false)
    setIsEditModalOpen(false)
    setEditingUserId(null)
    setUserForm(EMPTY_FORM)
    setErrorMessage('')
  }

  const handleExport = () => {
    const rows = filteredUsers.map((user) => [
      user.role,
      user.fullName,
      user.username,
      user.email,
      user.phone,
      user.dateCreated,
      user.status === 'Active' ? 'Actif' : 'Inactif',
    ])

    const csv = [
      ['Rôle', 'Nom complet', "Nom d'utilisateur", 'Email', 'Téléphone', 'Date de création', 'Statut'],
      ...rows,
    ]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'users.csv')
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const handleDeleteUser = async (user) => {
    const confirmed = window.confirm(`Supprimer l'utilisateur ${user.fullName} ?`)

    if (!confirmed) return

    setIsSubmitting(true)
    setErrorMessage('')

    try {
      await deleteUser(user.id)
      await loadUsers()
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.detail || 'Impossible de supprimer cet utilisateur pour le moment.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitUser = async (event) => {
    event.preventDefault()

    if (!userForm.fullName.trim() || !userForm.username.trim() || !userForm.email.trim()) {
      setErrorMessage('Veuillez renseigner le nom, le nom d\'utilisateur et l\'email.')
      return
    }

    if (!editingUserId && (!userForm.password || userForm.password !== userForm.confirmPassword)) {
      setErrorMessage('Les mots de passe ne correspondent pas.')
      return
    }

    const names = splitFullName(userForm.fullName)
    const basePayload = {
      username: userForm.username.trim(),
      email: userForm.email.trim(),
      telephone: userForm.phone.trim(),
      role: userForm.role,
      first_name: names.first_name,
      last_name: names.last_name,
      is_active: userForm.status === 'Active',
    }

    setIsSubmitting(true)
    setErrorMessage('')

    try {
      if (editingUserId) {
        await updateUser(editingUserId, basePayload)
      } else {
        await createUser({
          ...basePayload,
          password: userForm.password,
          re_password: userForm.confirmPassword,
        })
      }

      await loadUsers()
      closeModal()
    } catch (error) {
      const responseData = error?.response?.data
      const firstError =
        responseData?.detail ||
        responseData?.non_field_errors?.[0] ||
        responseData?.email?.[0] ||
        responseData?.username?.[0] ||
        responseData?.password?.[0] ||
        'Une erreur est survenue lors de l\'enregistrement.'

      setErrorMessage(firstError)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Title Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Gestion des utilisateurs
          </h1>
          <p className="text-sm font-medium text-slate-500">
            Gérez les utilisateurs de la plateforme, leurs rôles et les accès administratifs.
          </p>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      {/* Top Controls Bar (Search, Filters, Export, Add User) */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Left Side: Search & Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative min-w-[240px] flex-1 sm:flex-initial">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un nom d'utilisateur ou un email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>

          {/* Role Filter Dropdown */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          >
            <option value="ALL">Tous les rôles</option>
            <option value="ADMIN">Admin</option>
            <option value="FORMATEUR">Formateur</option>
            <option value="APPRENANT">Apprenant</option>
          </select>

          {/* Status Filter Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="Active">Actif</option>
            <option value="Inactive">Inactif</option>
          </select>
        </div>

        {/* Right Side: Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Exporter</span>
          </button>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-hover"
          >
            <Plus className="h-4 w-4" />
            <span>Ajouter un utilisateur</span>
          </button>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            {/* Table Header */}
            <thead className="border-b border-slate-200/80 bg-slate-50/60 text-xs font-bold uppercase text-slate-500">
              <tr>
                {/*<th className="px-4 py-4 w-10 text-center">
                  <input
                    type="checkbox"
                    onChange={handleSelectAll}
                    checked={
                      selectedUsers.length === filteredUsers.length &&
                      filteredUsers.length > 0
                    }
                    className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                  />
                </th>*/}
                <th className="px-4 py-4">
                  <div className="flex items-center gap-1.5 cursor-pointer">
                    <span>Rôle</span>
                    <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                </th>
                <th className="px-4 py-4">
                  <div className="flex items-center gap-1.5 cursor-pointer">
                    <span>Nom complet</span>
                    <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                </th>
                <th className="px-4 py-4">
                  <div className="flex items-center gap-1.5 cursor-pointer">
                    <span>Nom d&apos;utilisateur</span>
                    <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                </th>
                <th className="px-4 py-4">Email</th>
                <th className="px-4 py-4">Téléphone</th>
                <th className="px-4 py-4">
                  <div className="flex items-center gap-1.5 cursor-pointer">
                    <span>Date de création</span>
                    <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                </th>
                <th className="px-4 py-4">
                  <div className="flex items-center gap-1.5 cursor-pointer">
                    <span>Statut</span>
                    <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                </th>
                <th className="px-4 py-4 text-right">Actions</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-400">
                    Chargement des utilisateurs...
                  </td>
                </tr>
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user) => {
                  const isSelected = selectedUsers.includes(user.id)
                  return (
                    <tr
                      key={user.id}
                      className={`transition-colors hover:bg-slate-50/80 ${
                        isSelected ? 'bg-brand-light/40' : ''
                      }`}
                    >
                      {/* Checkbox 
                      <td className="px-4 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectUser(user.id)}
                          className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                        />
                      </td>*/}

                      {/* Role Badge */}
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold ${
                            user.role === 'ADMIN'
                              ? 'bg-purple-50 text-purple-700'
                              : user.role === 'FORMATEUR'
                                ? 'bg-brand-light text-brand'
                                : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {user.role === 'ADMIN' && <ShieldCheck className="h-3.5 w-3.5" />}
                          {user.role === 'FORMATEUR' && <GraduationCap className="h-3.5 w-3.5" />}
                          {user.role === 'APPRENANT' && <UserCheck className="h-3.5 w-3.5" />}
                          {user.role}
                        </span>
                      </td>

                      {/* Full Name */}
                      <td className="px-4 py-4 font-bold text-slate-900">{user.fullName}</td>

                      {/* Username */}
                      <td className="px-4 py-4 font-mono text-xs text-slate-600">
                        {user.username}
                      </td>

                      {/* Email */}
                      <td className="px-4 py-4 text-slate-600">{user.email}</td>

                      {/* Phone Number */}
                      <td className="px-4 py-4 font-mono text-xs text-slate-500">
                        {user.phone || '—'}
                      </td>

                      {/* Date Created */}
                      <td className="px-4 py-4 text-xs text-slate-500">{user.dateCreated}</td>

                      {/* Status */}
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              user.status === 'Active' ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          />
                          <span
                            className={
                              user.status === 'Active' ? 'text-emerald-600' : 'text-rose-600'
                            }
                          >
                            {user.status === 'Active' ? 'Actif' : 'Inactif'}
                          </span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/*<button
                            title="View Details"
                            onClick={() => handleViewUser(user)}
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          >
                            <Eye className="h-4 w-4" />
                          </button>*/}
                          <button
                            title="Modifier l'utilisateur"
                            onClick={() => openEditModal(user)}
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-brand"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            title="Supprimer l'utilisateur"
                            onClick={() => handleDeleteUser(user)}
                            disabled={isSubmitting}
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-400">
                    {hasAnyUsers
                      ? 'Aucun utilisateur ne correspond à vos filtres.'
                      : 'Aucun utilisateur disponible.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer & Pagination Bar */}
        <div className="flex flex-col justify-between gap-4 border-t border-slate-200/80 px-6 py-4 sm:flex-row sm:items-center">
          <span className="text-xs font-semibold text-slate-500">
            Affichage de <strong className="text-slate-800">{filteredUsers.length}</strong> sur{' '}
            <strong className="text-slate-800">{users.length}</strong> utilisateurs
          </span>

          {/* Pagination Controls */}
          <div className="flex items-center gap-1">
            <button
              title="Première page"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              title="Page précédente"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {/* Active Page Number */}
            <button className="flex h-8 min-w-[32px] items-center justify-center rounded-lg border border-brand bg-brand px-2 text-xs font-bold text-white">
              1
            </button>

            <button
              title="Page suivante"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              title="Dernière page"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Add User Modal */}
      {(isAddModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-light text-brand">
                  <UserPlus className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  {isEditModalOpen ? "Modifier l'utilisateur" : 'Ajouter un utilisateur'}
                </h3>
              </div>
              <button
                onClick={closeModal}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitUser} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-700">
                  Nom complet
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex. Hassan El Mansouri"
                  value={userForm.fullName}
                  onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-700">
                  Nom d&apos;utilisateur
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex. hmansouri"
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-700">
                  Adresse email
                </label>
                <input
                  type="email"
                  required
                  placeholder="ex. hassan@e-formation.ma"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-700">
                  Téléphone
                </label>
                <input
                  type="text"
                  placeholder="ex. +212 612-345678"
                  value={userForm.phone}
                  onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-700">
                  Rôle
                </label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  <option value="FORMATEUR">Formateur</option>
                  <option value="APPRENANT">Apprenant</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-700">
                  Statut
                </label>
                <select
                  value={userForm.status}
                  onChange={(e) => setUserForm({ ...userForm, status: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  <option value="Active">Actif</option>
                  <option value="Inactive">Inactif</option>
                </select>
              </div>

              {!isEditModalOpen ? (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase text-slate-700">
                      Mot de passe
                    </label>
                    <input
                      type="password"
                      required
                      value={userForm.password}
                      onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase text-slate-700">
                      Confirmer le mot de passe
                    </label>
                    <input
                      type="password"
                      required
                      value={userForm.confirmPassword}
                      onChange={(e) =>
                        setUserForm({ ...userForm, confirmPassword: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                    />
                  </div>
                </>
              ) : null}

              <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting
                    ? 'Enregistrement...'
                    : isEditModalOpen
                      ? "Mettre à jour l'utilisateur"
                      : "Créer l'utilisateur"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}