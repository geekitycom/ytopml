import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { createConfig, config as defaultConfig } from '../app/config.js'

// Every case passes an explicit environment object, so nothing here depends on
// the machine's real environment or on a .env file being present.
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
		test(`is unreachable for ${issuer}`, () => {
			const config = createConfig({ ...PUBLIC, OIDC_ISSUER_BASE_URL: issuer })
			assert.equal(config.rsscloud.reachable, false)
			assert.equal(config.rsscloud.active, false)
		})
	}

	test('is reachable for a public issuer url', () => {
		const config = createConfig(PUBLIC)
		assert.equal(config.rsscloud.reachable, true)
		assert.equal(config.rsscloud.active, true)
	})

	test('is unreachable when no issuer url is configured', () => {
		const config = createConfig({ ...PUBLIC, OIDC_ISSUER_BASE_URL: undefined })
		assert.equal(config.rsscloud.reachable, false)
		assert.equal(config.rsscloud.active, false)
	})

	test('does not mistake a hostname that merely contains localhost', () => {
		const config = createConfig({ ...PUBLIC, OIDC_ISSUER_BASE_URL: 'https://localhost.example.com' })
		assert.equal(config.rsscloud.reachable, true)
	})
})

describe('rssCloud configuration', () => {
	test('is inactive when explicitly disabled, even on a public url', () => {
		const config = createConfig({ ...PUBLIC, RSSCLOUD_ENABLED: 'false' })
		assert.equal(config.rsscloud.enabled, false)
		assert.equal(config.rsscloud.reachable, true)
		assert.equal(config.rsscloud.active, false)
	})

	test('is enabled by default when the variable is absent', () => {
		const config = createConfig({ ...PUBLIC, RSSCLOUD_ENABLED: undefined })
		assert.equal(config.rsscloud.enabled, true)
	})

	test('derives the ping and pleaseNotify endpoints from the server', () => {
		const config = createConfig(PUBLIC)
		assert.equal(config.rsscloud.pingUrl, 'https://rpc.rsscloud.io/ping')
		assert.equal(config.rsscloud.pleaseNotifyUrl, 'https://rpc.rsscloud.io/pleaseNotify')
	})

	test('strips trailing slashes from a configured server so urls do not double up', () => {
		const config = createConfig({ ...PUBLIC, RSSCLOUD_SERVER: 'https://cloud.example.com///' })
		assert.equal(config.rsscloud.pingUrl, 'https://cloud.example.com/ping')
	})

	test('falls back to the default server when none is configured', () => {
		const config = createConfig({ ...PUBLIC, RSSCLOUD_SERVER: undefined })
		assert.equal(config.rsscloud.server, 'https://rpc.rsscloud.io')
	})
})

describe('other configuration', () => {
	test('defaults the port and log level', () => {
		const config = createConfig({})
		assert.equal(config.oidc.port, 3000)
		assert.equal(config.oidc.logLevel, 'info')
	})

	test('reads the port as a number', () => {
		assert.equal(createConfig({ PORT: '8080' }).oidc.port, 8080)
	})

	test('generates a cookie secret when none is supplied', () => {
		const config = createConfig({})
		assert.equal(typeof config.oidc.cookieSecret, 'string')
		assert.equal(config.oidc.cookieSecret.length, 64)
	})

	test('exports a default config built from the real environment', () => {
		assert.ok(defaultConfig.rsscloud)
		assert.equal(typeof defaultConfig.rsscloud.active, 'boolean')
	})
})
