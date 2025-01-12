import { Hono } from 'hono'
import { render } from '../libs/render.js'
import crypto from 'node:crypto'

import { config } from '../config.js'
import { logger } from '../logger.js'

export function createAuthRouter(google) {
	const router = new Hono()

  // Login page
  router.get('/login', async (c) => {
  	const session = c.get('session')
  	logger.debug({ message: 'GET /auth/login', session })

  	session.set('state', crypto.randomBytes(32).toString('hex'))

    const url = google.getAuthorizationUrl(session.get('state'))
    return c.redirect(url)
  });

  // Logout page
  router.get('/logout', async (c) => {
    const session = c.get('session')
    logger.debug({ message: 'GET /auth/logout', session })

    session && session.deleteSession()

    return c.redirect(`${config.oidc.issuerBaseUrl}/`)
  });

  // OAuth 2.0 callback handler
  router.get('/callback', async (c) => {
  	const session = c.get('session')
    logger.debug({ message: 'GET /auth/callback', query: c.req.query(), session: session })

    if (c.req.query('error')) {
      return c.json({ error: c.req.query('error') }, 400)
    }

    if (c.req.query('state') !== session.get('state')) {
      return c.json({ error: 'invalid_request', error_description: 'Invalid state' }, 400)
    }

    let userInfo = {}

    try {
      if (c.req.query('code')) { 
        logger.debug({ message: 'GET /callback - getting token', code: c.req.query('code') })
        const tokenResponse = await google.getTokens(c.req.query('code'))
        session.set('tokens', tokenResponse)
        session.setExpiration(new Date(tokenResponse.expiry_date).toISOString());
        logger.debug({ message: 'GET /callback - getting user info', tokenResponse })
        userInfo = await google.getUserInfo(tokenResponse)
        session.set('user', userInfo)
      } else {
        logger.error({ message: 'GET /callback - invalid request' })
        return c.json({ error: 'invalid_request', error_description: 'Invalid request' }, 400)
      }
    } catch (error) {
      logger.error(error);
      return c.json({ error: 'access_denied', error_description: 'Access denied' }, 500)
    }

    logger.debug({ message: 'GET /callback - userInfo', userInfo });
    return c.redirect(`${config.oidc.issuerBaseUrl}/channels`)
  });

	return router
}