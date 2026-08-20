import client from './client.js'

// 1. Connexion (JWT)
export const loginUser = async (credentials) => {
  const response = await client.post(
    '/auth/jwt/create/',
    {
      email: credentials.email,
      password: credentials.password,
    },
    { skipAuthRefresh: true },
  )
  return response.data
}

// 2. Inscription Djoser
export const registerUser = async (userData) => {
  const payload = {
    username: userData.username || userData.email?.split('@')[0] || '',
    email: userData.email,
    password: userData.password,
    re_password: userData.confirm_password,
    first_name: userData.first_name,
    last_name: userData.last_name,
    telephone: userData.telephone,
    role: userData.role,
    specialite: userData.specialite,
    profil_professionnel: userData.profil_professionnel,
  }

  const response = await client.post('/auth/users/', payload)
  return response.data
}

// 3. Activation du compte
export const activateAccount = async ({ uid, token }) => {
  const response = await client.post('/auth/users/activation/', { uid, token })
  return response.data
}

// 4. Utilisateur connecté
export const getCurrentUser = async () => {
  const response = await client.get('/auth/users/me/')
  return response.data
}

// 5. Demande de réinitialisation mot de passe
export const requestPasswordReset = async (email) => {
  const response = await client.post('/auth/users/reset_password/', { email })
  return response.data
}

// 6. Confirmation du nouveau mot de passe
export const confirmPasswordReset = async ({ uid, token, new_password }) => {
  const response = await client.post('/auth/users/reset_password_confirm/', {
    uid,
    token,
    new_password,
    re_new_password: new_password,
  })
  return response.data
}

// 7. Déconnexion
export const logoutUser = () => {
  localStorage.removeItem('accessToken')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('user')
}