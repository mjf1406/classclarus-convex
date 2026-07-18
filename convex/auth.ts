import Google from '@auth/core/providers/google'
import { Password } from '@convex-dev/auth/providers/Password'
import { convexAuth } from '@convex-dev/auth/server'

const passwordEnabled = process.env.AUTH_PASSWORD_ENABLED === 'true'

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: passwordEnabled ? [Google, Password] : [Google],
})
