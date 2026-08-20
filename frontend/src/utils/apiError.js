const INVALID_CREDENTIALS_MESSAGES = new Set([
  'No active account found with the given credentials',
  'Unable to log in with provided credentials',
])

const INVALID_CREDENTIALS_FR =
  'Identifiants invalides. Vérifiez votre e-mail et votre mot de passe.'

export function toErrorText(value) {
  if (value == null || value === false) {
    return ''
  }

  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value)) {
    return toErrorText(value[0])
  }

  if (typeof value === 'object') {
    if (typeof value.detail === 'string' || Array.isArray(value.detail)) {
      return toErrorText(value.detail)
    }

    if (value.non_field_errors) {
      return toErrorText(value.non_field_errors)
    }

    const firstValue = Object.values(value).find((item) => item != null && item !== '')
    return toErrorText(firstValue)
  }

  return String(value)
}

export function getApiErrorMessage(error, fallbackMessage) {
  const data = error?.response?.data
  const raw =
    data?.detail ||
    data?.non_field_errors?.[0] ||
    data?.email?.[0] ||
    data?.password?.[0] ||
    data?.photo?.[0] ||
    data?.profil_professionnel?.[0] ||
    data?.username?.[0] ||
    data?.specialite?.[0] ||
    data ||
    error?.message

  const text = toErrorText(raw)

  if (INVALID_CREDENTIALS_MESSAGES.has(text)) {
    return INVALID_CREDENTIALS_FR
  }

  if (/is not a valid choice/i.test(text)) {
    return 'Cette valeur n’est pas reconnue. Choisissez une option dans la liste.'
  }

  return text || fallbackMessage
}
