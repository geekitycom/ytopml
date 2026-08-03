import { Hono } from 'hono'
import { render } from '../libs/render.js'
import { checkExpires, requireUser } from '../libs/auth.js'
import { toOpml } from '../libs/opml.js'
import { pingIfChanged } from '../libs/rsscloud.js'

import { config } from '../config.js'
import { logger } from '../logger.js'

// The cloud endpoint to advertise in generated OPML, or null when rssCloud is
// not active for this deployment.
function cloudUrl() {
	return config.rsscloud.active ? config.rsscloud.pleaseNotifyUrl : null
}

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
			const before = toOpml(await channelService.get(user.sub), cloudUrl())
			const fresh = await google.getChannels(tokens)
			channels = await channelService.merge(user.sub, fresh)
			await channelService.save(user.sub, channels)
			pingIfChanged(user.sub, before, toOpml(channels, cloudUrl()))
		} catch (error) {
			// A failed sync still renders, using whatever was stored last. Say so
			// loudly: silently serving a stale list is indistinguishable from a
			// healthy one, which hides an expired grant or a missing scope.
			logger.warn({ message: 'channel sync failed, serving stored channels', sub: user?.sub, error: error.message })
			channels = await channelService.get(user?.sub)
		}

		// Sort: selected first, then alphabetically by title
		channels.sort((a, b) => {
			if (a.selected !== b.selected) {
				return a.selected ? -1 : 1
			}
			return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
		})

		const selected = channels.reduce((acc, channel) => {
			acc += channel.selected ? 1 : 0
			return acc
		}, 0);

		return c.html(render('channels.njk', { channels, selected, sub: user.sub }))
	})

	router.post('/channels', requireUser, async (c) => {
		logger.debug({ message: 'POST /channels' })
		const session = c.get('session')
		const user = session.get('user')

		try {
			const selected = await c.req.json()

			// Validate input is an object with boolean values
			if (typeof selected !== 'object' || selected === null || Array.isArray(selected)) {
				return c.json({ error: 'Invalid input: expected object' }, 400)
			}

			const channels = await channelService.get(user.sub)
			const before = toOpml(channels, cloudUrl())
			channels.forEach(channel => {
				if (typeof selected[channel.id] === 'boolean') {
					channel.selected = selected[channel.id]
				}
			})
			await channelService.save(user.sub, channels)
			pingIfChanged(user.sub, before, toOpml(channels, cloudUrl()))
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
			const before = toOpml(await channelService.get(user.sub), cloudUrl())
			await channelService.destroy(user.sub)
			google.destroy(user.sub)
			// The list is now empty; subscribers should be told it emptied.
			pingIfChanged(user.sub, before, toOpml([], cloudUrl()))
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
		return c.text(toOpml(channels, cloudUrl()), 200, { 'Content-Type': 'text/xml' })
	})

	return router;
}
