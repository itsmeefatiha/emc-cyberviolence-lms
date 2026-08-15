/** Expanded sidebar width classes per role (fit longest nav labels). */
export const SIDEBAR_EXPANDED = {
  APPRENANT: { aside: 'w-60', content: 'pl-60' },
  FORMATEUR: { aside: 'w-72', content: 'pl-72' },
  ADMIN: { aside: 'w-64', content: 'pl-64' },
}

export function getSidebarLayout(role) {
  return SIDEBAR_EXPANDED[role] || SIDEBAR_EXPANDED.APPRENANT
}
