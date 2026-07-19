import { httpRouter } from 'convex/server'
import { auth } from './auth'
import { registerPasswordAuthHttpRoutes } from './authHttp'
import { isPasswordAuthEnabled } from './lib/passwordAuth'

const http = httpRouter()

if (isPasswordAuthEnabled()) {
  // Password-only self-host: register discovery/JWKS explicitly.
  // Do not call auth.addHttpRoutes — OAuth callbacks are unused, and we need
  // a guaranteed OpenID configuration route for JWT validation.
  registerPasswordAuthHttpRoutes(http)
} else {
  auth.addHttpRoutes(http)
}

export default http
