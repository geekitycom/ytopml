import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'

import { config } from '../app/config.js'
import { ping, opmlUrl, pingIfChanged } from '../app/libs/rsscloud.js'

let savedRsscloud
let savedIssuer
let savedFetch
let calls

// Stub global fetch so the suite never touches the network.
function stubFetch(handler) {
	globalThis.fetch = async (url, options) => {
		calls.push({ url, options })
		return handler(url, options)
	}
}

function jsonResponse(body, { ok = true, status = 200 } = {}) {
	return { ok, status, json: async () => body }
}

beforeEach(() => {
	savedRsscloud = { ...config.rsscloud }
	savedIssuer = config.oidc.issuerBaseUrl
	savedFetch = globalThis.fetch
	calls = []

	config.oidc.issuerBaseUrl = 'https://ytopml.example.com'
	config.rsscloud.active = true
	config.rsscloud.pingUrl = 'https://rpc.rsscloud.io/ping'
	config.rsscloud.timeout = 1000
})

afterEach(() => {
	Object.assign(config.rsscloud, savedRsscloud)
	config.oidc.issuerBaseUrl = savedIssuer
	globalThis.fetch = savedFetch
})

describe('opmlUrl', () => {
	test('builds the public url from the issuer base url', () => {
		assert.equal(opmlUrl('user123'), 'https://ytopml.example.com/user123.opml')
	})
})

describe('ping', () => {
	test('does not call out at all when rssCloud is inactive', async () => {
		config.rsscloud.active = false
		stubFetch(() => jsonResponse({ success: true }))

		assert.equal(await ping('user123'), false)
		assert.equal(calls.length, 0)
	})

	test('posts the opml url form encoded to the ping endpoint', async () => {
		stubFetch(() => jsonResponse({ success: true, msg: 'Thanks for the ping.' }))

		assert.equal(await ping('user123'), true)
		assert.equal(calls.length, 1)

		const [{ url, options }] = calls
		assert.equal(url, 'https://rpc.rsscloud.io/ping')
		assert.equal(options.method, 'POST')
		assert.equal(options.headers['Content-Type'], 'application/x-www-form-urlencoded')
		assert.equal(options.headers['Accept'], 'application/json')
		assert.equal(new URLSearchParams(options.body).get('url'), 'https://ytopml.example.com/user123.opml')
	})

	// The server answers HTTP 200 with success:false for soft failures, so a
	// status-only check would report every one of them as a success.
	test('treats HTTP 200 with success:false as a failure', async () => {
		stubFetch(() => jsonResponse({
			success: false,
			msg: 'The ping was cancelled because there was an error reading the resource.',
		}))

		assert.equal(await ping('user123'), false)
	})

	test('reports failure on a non-2xx response', async () => {
		stubFetch(() => jsonResponse({ success: false }, { ok: false, status: 500 }))
		assert.equal(await ping('user123'), false)
	})

	// Documents current behaviour, which is a weakness: the cloud server sends
	// text/xml unless Accept is honoured, and an unparseable body is reported as
	// a success even if that xml said success="false". See the test report.
	test('treats an unparseable body on a 200 as a success', async () => {
		stubFetch(() => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('not json') } }))
		assert.equal(await ping('user123'), true)
	})

	test('swallows a network error rather than throwing', async () => {
		stubFetch(() => { throw new TypeError('fetch failed') })
		await assert.doesNotReject(() => ping('user123'))
		assert.equal(await ping('user123'), false)
	})

	test('passes an abort signal so a hung server cannot block a save', async () => {
		stubFetch(() => jsonResponse({ success: true }))
		await ping('user123')
		assert.ok(calls[0].options.signal, 'expected an AbortSignal on the request')
	})
})

describe('pingIfChanged', () => {
	const BEFORE = '<opml><body><outline text="Alpha"/></body></opml>'
	const SAME = '<opml><body><outline text="Alpha"/></body></opml>'
	const DIFFERENT = '<opml><body/></opml>'

	// pingIfChanged does not await the ping, so let the microtask queue drain.
	const settle = () => new Promise(resolve => setImmediate(resolve))

	test('does not ping when the rendered opml is unchanged', async () => {
		stubFetch(() => jsonResponse({ success: true }))
		assert.equal(pingIfChanged('u1', BEFORE, SAME), false)
		await settle()
		assert.equal(calls.length, 0)
	})

	test('pings when the rendered opml changed', async () => {
		stubFetch(() => jsonResponse({ success: true }))
		assert.equal(pingIfChanged('u1', BEFORE, DIFFERENT), true)
		await settle()
		assert.equal(calls.length, 1)
		assert.equal(new URLSearchParams(calls[0].options.body).get('url'), 'https://ytopml.example.com/u1.opml')
	})

	test('does not throw when the ping itself fails', async () => {
		stubFetch(() => { throw new TypeError('fetch failed') })
		assert.doesNotThrow(() => pingIfChanged('u1', BEFORE, DIFFERENT))
		await settle()
	})
})
