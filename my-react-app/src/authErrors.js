export function explainAuthError(error) {
  const code = error?.code || ''
  if (code === 'auth/configuration-not-found' || code === 'auth/operation-not-allowed') {
    return 'Email and password sign-in is turned off. In Firebase, open Authentication, click Get started, then enable Email/Password.'
  }
  if (code === 'auth/invalid-api-key' || code === 'auth/invalid-app-credential') {
    return 'Firebase rejected the app configuration. Check the VITE_FIREBASE environment values.'
  }
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found' ||
    code === 'auth/invalid-login-credentials'
  ) {
    return 'Email or password does not match.'
  }
  if (code === 'auth/invalid-email') return 'Enter a valid email address.'
  if (code === 'auth/missing-password') return 'Enter a password.'
  if (code === 'auth/weak-password') return 'Use at least 6 characters for the password.'
  if (code === 'auth/email-already-in-use') return 'That email already has an account. Sign in instead.'
  if (code === 'auth/too-many-requests') return 'Too many attempts. Wait a moment and try again.'
  if (code === 'auth/network-request-failed') return 'The network request failed. Check the connection and try again.'
  if (code === 'permission-denied') return 'Saved setups are blocked by the database rules.'
  return 'That did not work. Check the email and password and try again.'
}
