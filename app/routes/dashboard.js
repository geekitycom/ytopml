import { Hono } from 'hono'
import { render } from '../libs/render.js'
import { checkExpires, requireUser } from '../libs/auth.js'
import { toOpml } from '../libs/opml.js'

import { config } from '../config.js'
import { logger } from '../logger.js'

export function createDashboardRouter(google, channelService) {
	const router = new Hono()

	router.get('/', checkExpires, async (c) => {
	  const session = c.get('session')
	  const tokens = session.get('tokens')

	  if (tokens && tokens.expiry_date > Date.now()) {
	  	return c.redirect(`${config.oidc.issuerBaseUrl}/channels`)
	  }

	  return c.html(render('home.njk'))
	})

	router.get('/privacy', checkExpires, async (c) => {
		const title = 'Privacy Policy'
		return c.html(render('privacy.njk', { title }))
	})

	router.get('/terms', checkExpires, async (c) => {
		const title = 'Terms of Use'
		return c.html(render('terms.njk', { title }))
	})

	router.get('/channels', requireUser, async (c) => {
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

	router.get('/:sub.opml', async (c) => {
		const path = c.req.param('sub.opml')
		const sub = path.split('.')[0]
		const channels = await channelService.get(sub)
		logger.debug('opml', { sub, channels })
		return c.text(toOpml(channels), 200, { 'Content-Type': 'text/xml' })
	})

	return router;
}
