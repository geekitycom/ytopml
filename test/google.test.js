import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { GoogleProvider } from '../app/libs/google.js'

// generateAuthUrl only builds a string, so the authorization url can be checked
// without any network access.
function authUrl() {
	return new URL(new GoogleProvider().getAuthorizationUrl('state-token'))
}

describe('getAuthorizationUrl', () => {
	test('asks for the youtube scope', () => {
		const scope = authUrl().searchParams.get('scope')
		assert.match(scope, /https:\/\/www\.googleapis\.com\/auth\/youtube\.readonly/)
	})

	test('asks for openid', () => {
		assert.match(authUrl().searchParams.get('scope'), /openid/)
	})

	test('passes the state through for csrf protection', () => {
		assert.equal(authUrl().searchParams.get('state'), 'state-token')
	})

	test('requests offline access', () => {
		assert.equal(authUrl().searchParams.get('access_type'), 'offline')
	})

	// Without this, Google reuses an earlier grant and can hand back a token
	// carrying only the scopes that grant had. Adding a scope then silently
	// fails: the sign in succeeds but the API rejects every call with
	// "Request had insufficient authentication scopes".
	test('forces a consent screen so an added scope is actually granted', () => {
		assert.equal(authUrl().searchParams.get('prompt'), 'consent')
	})
})
