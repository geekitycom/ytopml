import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { Hono } from 'hono'

import { createDashboardRouter } from '../app/routes/dashboard.js'
import { logger } from '../app/logger.js'

// A stand-in for the hono-sessions session object, which the routes and the
// auth middleware only ever read through get()/deleteSession().
function fakeSession(data = {}) {
	return {
		deleted: false,
		get(key) { return data[key] },
		deleteSession() { this.deleted = true },
	}
}

const USER = { sub: 'user123' }
const LIVE_TOKENS = { expiry_date: Date.now() + 60_000 }
const EXPIRED_TOKENS = { expiry_date: Date.now() - 60_000 }

function channel(id, title, selected) {
	return {
		id,
		title,
		selected,
		feedUrl: `https://www.youtube.com/feeds/videos.xml?channel_id=${id}`,
	}
}

// Records what the routes asked of storage so tests can assert on it.
function fakeChannelService(initial = []) {
	return {
		stored: [...initial],
		saved: null,
		destroyed: null,
		merged: null,
		async get() { return this.stored.map(c => ({ ...c })) },
		async save(sub, channels) { this.saved = { sub, channels }; this.stored = channels; return channels },
		async merge(sub, fresh) { this.merged = { sub, fresh }; return fresh },
		async destroy(sub) { this.destroyed = sub; return true },
	}
}

function makeApp({ session, google = {}, channels = {} } = {}) {
	const app = new Hono()
	app.use('*', async (c, next) => {
		c.set('session', session)
		await next()
	})
	app.route('/', createDashboardRouter(google, channels))
	return app
}

// Never let a test reach the network: if a developer's .env points at a public
// issuer url, rssCloud is active and saving would ping the real cloud server.
let savedFetch
let fetchCalls

beforeEach(() => {
	savedFetch = globalThis.fetch
	fetchCalls = []
	globalThis.fetch = async (url, options) => {
		fetchCalls.push({ url, options })
		return { ok: true, status: 200, json: async () => ({ success: true }) }
	}
})

afterEach(() => {
	globalThis.fetch = savedFetch
})

describe('GET /:sub.opml', () => {
	test('serves the stored list as xml', async () => {
		const channels = fakeChannelService([channel('UC1', 'Alpha', true)])
		const res = await makeApp({ session: fakeSession(), channels }).request('/user123.opml')

		assert.equal(res.status, 200)
		assert.match(res.headers.get('content-type'), /text\/xml/)
		const body = await res.text()
		assert.match(body, /<opml version="1\.0"/)
		assert.match(body, /text="Alpha"/)
	})

	test('is public — it does not require a session', async () => {
		const channels = fakeChannelService([channel('UC1', 'Alpha', true)])
		const res = await makeApp({ session: undefined, channels }).request('/user123.opml')
		assert.equal(res.status, 200)
	})

	test('omits channels the user has not selected', async () => {
		const channels = fakeChannelService([channel('UC1', 'Alpha', true), channel('UC2', 'Beta', false)])
		const res = await makeApp({ session: fakeSession(), channels }).request('/user123.opml')

		const body = await res.text()
		assert.match(body, /Alpha/)
		assert.doesNotMatch(body, /Beta/)
	})

	test('serves an empty list for an unknown user', async () => {
		const res = await makeApp({ session: fakeSession(), channels: fakeChannelService([]) }).request('/nobody.opml')

		assert.equal(res.status, 200)
		assert.doesNotMatch(await res.text(), /<outline/)
	})

	test('looks up the user named by the filename', async () => {
		let requested
		const channels = { async get(sub) { requested = sub; return [] } }
		await makeApp({ session: fakeSession(), channels }).request('/abc123.opml')
		assert.equal(requested, 'abc123')
	})
})

describe('POST /channels', () => {
	function authed(channels) {
		return makeApp({ session: fakeSession({ tokens: LIVE_TOKENS, user: USER }), channels })
	}

	function postJson(app, body) {
		return app.request('/channels', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		})
	}

	test('saves the selections it is given', async () => {
		const channels = fakeChannelService([channel('UC1', 'Alpha', false), channel('UC2', 'Beta', true)])
		const res = await postJson(authed(channels), { UC1: true, UC2: false })

		assert.equal(res.status, 200)
		assert.deepEqual(await res.json(), { success: true })
		assert.equal(channels.saved.sub, 'user123')
		assert.deepEqual(channels.saved.channels.map(c => [c.id, c.selected]), [['UC1', true], ['UC2', false]])
	})

	test('rejects an array', async () => {
		const res = await postJson(authed(fakeChannelService()), [1, 2, 3])
		assert.equal(res.status, 400)
		assert.deepEqual(await res.json(), { error: 'Invalid input: expected object' })
	})

	test('rejects null', async () => {
		const res = await postJson(authed(fakeChannelService()), null)
		assert.equal(res.status, 400)
	})

	test('rejects a bare string', async () => {
		const res = await postJson(authed(fakeChannelService()), 'nope')
		assert.equal(res.status, 400)
	})

	test('does not save when the input is rejected', async () => {
		const channels = fakeChannelService([channel('UC1', 'Alpha', false)])
		await postJson(authed(channels), [1, 2, 3])
		assert.equal(channels.saved, null)
	})

	test('ignores values that are not booleans', async () => {
		const channels = fakeChannelService([channel('UC1', 'Alpha', false)])
		await postJson(authed(channels), { UC1: 'yes' })
		assert.equal(channels.saved.channels[0].selected, false)
	})

	test('ignores ids it does not know about', async () => {
		const channels = fakeChannelService([channel('UC1', 'Alpha', false)])
		await postJson(authed(channels), { UC1: true, UC_UNKNOWN: true })
		assert.deepEqual(channels.saved.channels.map(c => c.id), ['UC1'])
	})

	test('answers 500 when the body is not valid json', async () => {
		const res = await authed(fakeChannelService()).request('/channels', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: '{ not json',
		})
		assert.equal(res.status, 500)
		assert.deepEqual(await res.json(), { error: 'Failed to save channels' })
	})

	test('redirects an unauthenticated request instead of saving', async () => {
		const channels = fakeChannelService([channel('UC1', 'Alpha', false)])
		const app = makeApp({ session: fakeSession(), channels })
		const res = await postJson(app, { UC1: true })

		assert.equal(res.status, 302)
		assert.equal(channels.saved, null)
	})

	test('redirects when the session has expired instead of saving', async () => {
		const channels = fakeChannelService([channel('UC1', 'Alpha', false)])
		const app = makeApp({ session: fakeSession({ tokens: EXPIRED_TOKENS, user: USER }), channels })
		const res = await postJson(app, { UC1: true })

		assert.equal(res.status, 302)
		assert.equal(channels.saved, null)
	})
})

describe('authentication', () => {
	test('GET /channels redirects without a session', async () => {
		const res = await makeApp({ session: fakeSession(), channels: fakeChannelService() }).request('/channels')
		assert.equal(res.status, 302)
		assert.ok(res.headers.get('location').endsWith('/'))
	})

	test('GET /channels redirects when the tokens have expired', async () => {
		const session = fakeSession({ tokens: EXPIRED_TOKENS, user: USER })
		const res = await makeApp({ session, channels: fakeChannelService() }).request('/channels')
		assert.equal(res.status, 302)
	})

	test('GET /channels clears the session it rejected', async () => {
		const session = fakeSession({ tokens: EXPIRED_TOKENS, user: USER })
		await makeApp({ session, channels: fakeChannelService() }).request('/channels')
		assert.equal(session.deleted, true)
	})

	test('GET /settings redirects without a session', async () => {
		const res = await makeApp({ session: fakeSession(), channels: fakeChannelService() }).request('/settings')
		assert.equal(res.status, 302)
	})
})

describe('GET /', () => {
	test('sends a signed-in visitor to their channels', async () => {
		const session = fakeSession({ tokens: LIVE_TOKENS, user: USER })
		const res = await makeApp({ session, channels: fakeChannelService() }).request('/')

		assert.equal(res.status, 302)
		assert.ok(res.headers.get('location').endsWith('/channels'))
	})

	test('renders the home page for a visitor who is not signed in', async () => {
		const res = await makeApp({ session: fakeSession(), channels: fakeChannelService() }).request('/')

		assert.equal(res.status, 200)
		assert.match(res.headers.get('content-type'), /text\/html/)
	})

	test('renders the privacy and terms pages', async () => {
		const app = makeApp({ session: fakeSession(), channels: fakeChannelService() })
		assert.equal((await app.request('/privacy')).status, 200)
		assert.equal((await app.request('/terms')).status, 200)
	})
})

describe('GET /channels', () => {
	test('merges fresh subscriptions and saves them', async () => {
		const channels = fakeChannelService([])
		const google = { async getChannels() { return [channel('UC1', 'Alpha', true)] } }
		const session = fakeSession({ tokens: LIVE_TOKENS, user: USER })

		const res = await makeApp({ session, google, channels }).request('/channels')

		assert.equal(res.status, 200)
		assert.equal(channels.merged.sub, 'user123')
		assert.equal(channels.saved.sub, 'user123')
	})

	test('warns when it falls back, so a broken sync is not silent', async () => {
		const warnings = []
		const realWarn = logger.warn
		logger.warn = (...args) => { warnings.push(args[0]) }

		try {
			const channels = fakeChannelService([channel('UC1', 'Alpha', true)])
			const google = { async getChannels() { throw new Error('insufficient authentication scopes') } }
			const session = fakeSession({ tokens: LIVE_TOKENS, user: USER })

			await makeApp({ session, google, channels }).request('/channels')
		} finally {
			logger.warn = realWarn
		}

		assert.equal(warnings.length, 1, 'expected exactly one warning about the failed sync')
		assert.match(JSON.stringify(warnings[0]), /insufficient authentication scopes/)
	})

	test('falls back to stored channels when the google call fails', async () => {
		const channels = fakeChannelService([channel('UC1', 'Alpha', true)])
		const google = { async getChannels() { throw new Error('quota exceeded') } }
		const session = fakeSession({ tokens: LIVE_TOKENS, user: USER })

		const res = await makeApp({ session, google, channels }).request('/channels')

		assert.equal(res.status, 200)
		assert.equal(channels.saved, null)
		// The stored list must still reach the page, not an empty one.
		assert.match(await res.text(), /Alpha/)
	})
})

describe('POST /settings', () => {
	// This route deletes an account, so an unauthenticated request must be
	// turned away by the same guard as every other authenticated route rather
	// than reaching the handler and crashing on a null user.
	test('redirects an unauthenticated request instead of destroying anything', async () => {
		const channels = fakeChannelService([channel('UC1', 'Alpha', true)])
		const google = { destroy() { throw new Error('should not be called') } }
		const res = await makeApp({ session: fakeSession(), google, channels }).request('/settings', { method: 'POST' })

		assert.equal(res.status, 302)
		assert.equal(channels.destroyed, null)
	})

	test('redirects an expired session instead of destroying anything', async () => {
		const channels = fakeChannelService([channel('UC1', 'Alpha', true)])
		const google = { destroy() { throw new Error('should not be called') } }
		const session = fakeSession({ tokens: EXPIRED_TOKENS, user: USER })
		const res = await makeApp({ session, google, channels }).request('/settings', { method: 'POST' })

		assert.equal(res.status, 302)
		assert.equal(channels.destroyed, null)
	})

	test('destroys the stored channels and signs the user out', async () => {
		const channels = fakeChannelService([channel('UC1', 'Alpha', true)])
		let destroyedFromGoogle
		const google = { destroy(sub) { destroyedFromGoogle = sub } }
		const session = fakeSession({ tokens: LIVE_TOKENS, user: USER })

		const res = await makeApp({ session, google, channels }).request('/settings', { method: 'POST' })

		assert.equal(res.status, 302)
		assert.ok(res.headers.get('location').endsWith('/auth/logout'))
		assert.equal(channels.destroyed, 'user123')
		assert.equal(destroyedFromGoogle, 'user123')
	})
})
