import {
  invalidateSessions,
  modifyAccountCredentials,
  retrieveAccount,
} from '@convex-dev/auth/server'
import { v } from 'convex/values'
import { internalAction } from './_generated/server'
import {
  assertValidEmail,
  isPasswordAuthEnabled,
  validatePasswordRequirements,
} from './lib/passwordAuth'

/**
 * Self-host admin recovery: set a new password for an email/password account.
 *
 * Run from the Convex dashboard (Functions → adminAuth.resetPassword) with the
 * deployment admin key. Existing passwords cannot be revealed — only replaced —
 * because Convex Auth stores a hash, not the plaintext.
 *
 * Gated: throws unless AUTH_PASSWORD_ENABLED=true on this deployment.
 */
export const resetPassword = internalAction({
  args: {
    email: v.string(),
    newPassword: v.string(),
  },
  returns: v.object({
    success: v.literal(true),
  }),
  handler: async (ctx, args) => {
    if (!isPasswordAuthEnabled()) {
      throw new Error(
        'Password auth is not enabled (AUTH_PASSWORD_ENABLED must be true).',
      )
    }

    const email = assertValidEmail(args.email)
    validatePasswordRequirements(args.newPassword)

    const { user } = await retrieveAccount(ctx, {
      provider: 'password',
      account: { id: email },
    })

    await modifyAccountCredentials(ctx, {
      provider: 'password',
      account: { id: email, secret: args.newPassword },
    })

    await invalidateSessions(ctx, { userId: user._id })

    return { success: true as const }
  },
})
