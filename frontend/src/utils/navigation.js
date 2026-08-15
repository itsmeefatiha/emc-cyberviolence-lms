/**
 * Home path by user role after login / public-route bounce.
 */
export function getHomePath(role) {
  switch (role) {
    case 'ADMIN':
      return '/admin/dashboard'
    case 'FORMATEUR':
      return '/instructor/dashboard'
    case 'APPRENANT':
    default:
      return '/dashboard'
  }
}
