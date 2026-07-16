// convex/convex.config.ts
import { defineApp } from 'convex/server'
import authz from '@djpanda/convex-authz/convex.config'
import tenants from '@djpanda/convex-tenants/convex.config'

const app = defineApp()
app.use(authz)
app.use(tenants)

export default app
