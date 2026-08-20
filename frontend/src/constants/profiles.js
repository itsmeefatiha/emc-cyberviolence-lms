export const PROFIL_LABELS = {
  EDUCATEUR: 'Éducateur',
  FORCES_ORDRE: "Forces de l'ordre",
  MAGISTRAT: 'Magistrat',
  ASSISTANT_SOCIAL: 'Assistant social',
  AUTRE: 'Autre',
}

export const PROFIL_OPTIONS = Object.entries(PROFIL_LABELS).map(([value, label]) => ({
  value,
  label,
}))

export function getProfilLabel(value, fallback = 'Non spécifié') {
  if (!value) {
    return fallback
  }
  return PROFIL_LABELS[value] || value
}
