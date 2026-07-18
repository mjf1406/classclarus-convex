import Google from '@auth/core/providers/google'
import { Password } from '@convex-dev/auth/providers/Password'
import { convexAuth } from '@convex-dev/auth/server'

const passwordEnabled = process.env.AUTH_PASSWORD_ENABLED === 'true'
const googleEnabled =
  Boolean(process.env.AUTH_GOOGLE_ID) &&
  Boolean(process.env.AUTH_GOOGLE_SECRET)

const providers = [
  ...(passwordEnabled ? [Password] : []),
  ...(googleEnabled ? [Google] : []),
]

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: providers.length > 0 ? providers : [Google],
})
