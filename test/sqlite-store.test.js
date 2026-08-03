import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'

import { SqliteStore } from '../app/libs/sqlite-store.js'

let db
let store

beforeEach(() => {
	db = new DatabaseSync(':memory:')
	store = new SqliteStore(db)
})

describe('SqliteStore', () => {
	test('creates its table on construction', () => {
		const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
		assert.deepEqual(tables.map(t => t.name), ['sessions'])
	})

	test('is safe to construct twice against the same database', () => {
		assert.doesNotThrow(() => new SqliteStore(db))
	})

	test('honours a custom table name', () => {
		new SqliteStore(db, 'other_sessions')
		const names = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name)
		assert.ok(names.includes('other_sessions'))
	})

	test('returns null for a session that was never created', () => {
		assert.equal(store.getSessionById('missing'), null)
	})

	test('round-trips a created session', () => {
		store.createSession('s1', { user: { sub: 'u1' }, count: 1 })
		assert.deepEqual(store.getSessionById('s1'), { user: { sub: 'u1' }, count: 1 })
	})

	test('round-trips nested and non-string values', () => {
		const data = { tokens: { expiry_date: 1234567890, scopes: ['a', 'b'] }, ok: true, missing: null }
		store.createSession('s1', data)
		assert.deepEqual(store.getSessionById('s1'), data)
	})

	test('overwrites session data on persist', () => {
		store.createSession('s1', { step: 'first' })
		store.persistSessionData('s1', { step: 'second' })
		assert.deepEqual(store.getSessionById('s1'), { step: 'second' })
	})

	test('deletes a session', () => {
		store.createSession('s1', { a: 1 })
		store.deleteSession('s1')
		assert.equal(store.getSessionById('s1'), null)
	})

	test('keeps sessions isolated from one another', () => {
		store.createSession('s1', { who: 'one' })
		store.createSession('s2', { who: 'two' })
		store.deleteSession('s1')
		assert.equal(store.getSessionById('s1'), null)
		assert.deepEqual(store.getSessionById('s2'), { who: 'two' })
	})

	test('rejects a duplicate session id', () => {
		store.createSession('s1', { a: 1 })
		assert.throws(() => store.createSession('s1', { a: 2 }))
	})
})
