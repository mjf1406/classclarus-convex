import Google from '@auth/core/providers/google'
import { Password } from '@convex-dev/auth/providers/Password'
import { convexAuth } from '@convex-dev/auth/server'
import type { Value } from 'convex/values'
import type { DataModel } from './_generated/dataModel'
import {
  assertValidEmail,
  isPasswordAuthEnabled,
  validatePasswordRequirements,
} from './lib/passwordAuth'

const passwordProvider = Password<DataModel>({
  profile(params: Record<string, Value | undefined>) {
    const email = assertValidEmail(String(params.email ?? ''))
    const nameRaw = params.name
    const name =
      typeof nameRaw === 'string' && nameRaw.trim().length > 0
        ? nameRaw.trim()
        : undefined
    return name ? { email, name } : { email }
  },
  validatePasswordRequirements,
})

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: isPasswordAuthEnabled() ? [passwordProvider] : [Google],
})
