import { Hono } from 'hono'
import { render } from '../libs/render.js'
import { checkExpires, requireUser } from '../libs/auth.js'
import { toOpml } from '../libs/opml.js'

import { config } from '../config.js'
import { logger } from '../logger.js'

export function createDashboardRouter(google, channelService) {
	const router = new Hono()

	router.get('/', checkExpires, async (c) => {
		logger.debug({ message: 'GET /' })
	  const session = c.get('session')
	  const tokens = session.get('tokens')

	  if (tokens && tokens.expiry_date > Date.now()) {
	  	return c.redirect(`${config.oidc.issuerBaseUrl}/channels`)
	  }

	  return c.html(render('home.njk'))
	})

	router.get('/privacy', checkExpires, async (c) => {
		logger.debug({ message: 'GET /privacy' })
		const title = 'Privacy Policy'
		return c.html(render('privacy.njk', { title }))
	})

	router.get('/terms', checkExpires, async (c) => {
		logger.debug({ message: 'GET /terms' })
		const title = 'Terms of Use'
		return c.html(render('terms.njk', { title }))
	})

	router.get('/channels', requireUser, async (c) => {
		logger.debug({ message: 'GET /channels' })
		const session = c.get('session')
		const tokens = session.get('tokens')
		const user = session.get('user')
		let channels = []
		
		try {
			const fresh = await google.getChannels(tokens)
			channels = await channelService.merge(user.sub, fresh)
			await channelService.save(user.sub, channels)
		} catch (error) {
			channels = await channelService.get(user.sub)
		}

		const selected = channels.reduce((acc, channel) => {
			acc += channel.selected ? 1 : 0
			return acc
		}, 0);

		return c.html(render('channels.njk', { channels, selected, sub: user.sub }))
	})

	router.post('/channels', async (c) => {
		logger.debug({ message: 'POST /channels' })
		const session = c.get('session')
		const user = session.get('user')
		
		try {
			const channels = await channelService.get(user.sub)
			const selected = await c.req.json()
			channels.forEach(channel => {
				channel.selected = selected[channel.id]
			})
			await channelService.save(user.sub, channels)
		} catch (error) {
			logger.error(error)
			return c.json({ error: 'Failed to save channels' }, 500)
		}

		return c.json({ success: true })
	})

	router.get('/settings', requireUser, async (c) => {
		logger.debug({ message: 'GET /settings' })
		return c.html(render('settings.njk'))
	})

	router.post('/settings', async (c) => {
		logger.debug({ message: 'POST /settings' })
		const session = c.get('session')
		const user = session.get('user')

		try {
			await channelService.destroy(user.sub)
			google.destroy(user.sub)
			return c.redirect(`${config.oidc.issuerBaseUrl}/auth/logout`)
		} catch (error) {
			logger.error(error)
			return c.json({ error: 'Failed to save settings' }, 500)
		}
	})

	router.get('/:filename{.+\\.opml}', async (c) => {
		const filename = c.req.param('filename')
		const sub = filename.split('.')[0]
		logger.debug({ 
			message: 'GET /:sub([^/]+).opml', 
			path: c.req.path,
			sub 
		})
		const channels = await channelService.get(sub)
		logger.debug('opml', { sub, channels })
		return c.text(toOpml(channels), 200, { 'Content-Type': 'text/xml' })
	})

	return router;
}
