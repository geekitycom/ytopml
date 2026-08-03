import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

// config.js reads the environment once at import, so each case loads a fresh
// copy of the module via a unique specifier. Every variable the assertions
// depend on is set explicitly — a real .env would otherwise supply the value
// for anything left unset and make the run machine dependent.
let counter = 0

async function loadConfig(env) {
	const keys = ['OIDC_ISSUER_BASE_URL', 'RSSCLOUD_ENABLED', 'RSSCLOUD_SERVER']
	const saved = {}

	for (const key of keys) {
		saved[key] = process.env[key]
		if (env[key] === undefined) {
			delete process.env[key]
		} else {
			process.env[key] = env[key]
		}
	}

	try {
		const { config } = await import(`../app/config.js?case=${counter++}`)
		return config
	} finally {
		for (const key of keys) {
			if (saved[key] === undefined) {
				delete process.env[key]
			} else {
				process.env[key] = saved[key]
			}
		}
	}
}

const PUBLIC = {
	OIDC_ISSUER_BASE_URL: 'https://ytopml.example.com',
	RSSCLOUD_ENABLED: 'true',
	RSSCLOUD_SERVER: 'https://rpc.rsscloud.io',
}

describe('rssCloud reachability', () => {
	for (const issuer of [
		'http://localhost:3000',
		'https://localhost',
		'http://127.0.0.1:3000',
		'http://[::1]:3000',
	]) {
		test(`is unreachable for ${issuer}`, async () => {
			const config = await loadConfig({ ...PUBLIC, OIDC_ISSUER_BASE_URL: issuer })
			assert.equal(config.rsscloud.reachable, false)
			assert.equal(config.rsscloud.active, false)
		})
	}

	test('is reachable for a public issuer url', async () => {
		const config = await loadConfig(PUBLIC)
		assert.equal(config.rsscloud.reachable, true)
		assert.equal(config.rsscloud.active, true)
	})

	test('is unreachable when no issuer url is configured', async () => {
		const config = await loadConfig({ ...PUBLIC, OIDC_ISSUER_BASE_URL: undefined })
		assert.equal(config.rsscloud.reachable, false)
		assert.equal(config.rsscloud.active, false)
	})

	test('does not mistake a hostname that merely contains localhost', async () => {
		const config = await loadConfig({ ...PUBLIC, OIDC_ISSUER_BASE_URL: 'https://localhost.example.com' })
		assert.equal(config.rsscloud.reachable, true)
	})
})

describe('rssCloud configuration', () => {
	test('is inactive when explicitly disabled, even on a public url', async () => {
		const config = await loadConfig({ ...PUBLIC, RSSCLOUD_ENABLED: 'false' })
		assert.equal(config.rsscloud.enabled, false)
		assert.equal(config.rsscloud.reachable, true)
		assert.equal(config.rsscloud.active, false)
	})

	test('is enabled by default when the variable is absent', async () => {
		const config = await loadConfig({ ...PUBLIC, RSSCLOUD_ENABLED: undefined })
		assert.equal(config.rsscloud.enabled, true)
	})

	test('derives the ping and pleaseNotify endpoints from the server', async () => {
		const config = await loadConfig(PUBLIC)
		assert.equal(config.rsscloud.pingUrl, 'https://rpc.rsscloud.io/ping')
		assert.equal(config.rsscloud.pleaseNotifyUrl, 'https://rpc.rsscloud.io/pleaseNotify')
	})

	test('strips trailing slashes from a configured server so urls do not double up', async () => {
		const config = await loadConfig({ ...PUBLIC, RSSCLOUD_SERVER: 'https://cloud.example.com///' })
		assert.equal(config.rsscloud.pingUrl, 'https://cloud.example.com/ping')
	})

	test('falls back to the default server when none is configured', async () => {
		const config = await loadConfig({ ...PUBLIC, RSSCLOUD_SERVER: undefined })
		assert.equal(config.rsscloud.server, 'https://rpc.rsscloud.io')
	})
})
