import { RateLimiter, MINUTE } from '@convex-dev/rate-limiter'
import { components } from './_generated/api'

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  // Same effective budget as the old joinAttempts table: 10 / 5 min per user
  joinCodePerUser: {
    kind: 'fixed window',
    rate: 10,
    period: 5 * MINUTE,
  },
  // Shared ceiling so N accounts cannot linear-scale guesses
  joinCodeGlobal: {
    kind: 'fixed window',
    rate: 200,
    period: 5 * MINUTE,
    shards: 4,
  },
})
