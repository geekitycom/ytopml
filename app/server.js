import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'

import app from './app.js'
import { config } from './config.js'
import { logger } from './logger.js'

app.use('/*', serveStatic({ root: './public' }))

// PORT was previously read into config but never passed on, so the server
// always listened on the library default of 3000 whatever it was set to.
serve({ fetch: app.fetch, port: config.oidc.port }, ({ port }) => {
  logger.info({ message: 'listening', port, issuer: config.oidc.issuerBaseUrl })
})