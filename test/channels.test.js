import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ChannelService } from '../app/libs/channels.js'

let dataDir
let service

beforeEach(async () => {
	dataDir = await mkdtemp(join(tmpdir(), 'ytopml-channels-'))
	service = new ChannelService(dataDir)
})

afterEach(async () => {
	await rm(dataDir, { recursive: true, force: true })
})

function channel(id, title, extra = {}) {
	return {
		id,
		title,
		feedUrl: `https://www.youtube.com/feeds/videos.xml?channel_id=${id}`,
		...extra,
	}
}

describe('ChannelService storage', () => {
	test('returns an empty list for a user with no saved file', async () => {
		assert.deepEqual(await service.get('nobody'), [])
	})

	test('returns an empty list rather than throwing when the id is missing', async () => {
		assert.deepEqual(await service.get(null), [])
	})

	test('round-trips saved channels, adding the derived htmlUrl on read', async () => {
		await service.save('u1', [channel('UC1', 'Alpha', { selected: true })])
		assert.deepEqual(await service.get('u1'), [{
			id: 'UC1',
			title: 'Alpha',
			selected: true,
			feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC1',
			htmlUrl: 'https://www.youtube.com/channel/UC1',
		}])
	})

	test('writes one file per user', async () => {
		await service.save('u1', [channel('UC1', 'Alpha', { selected: true })])
		await service.save('u2', [channel('UC2', 'Beta', { selected: false })])
		assert.equal((await service.get('u1'))[0].id, 'UC1')
		assert.equal((await service.get('u2'))[0].id, 'UC2')
	})

	test('backfills a missing htmlUrl on read', async () => {
		// Simulates a file written before htmlUrl was stored.
		await service.save('u1', [{ id: 'UC1', title: 'Alpha', selected: true, feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC1' }])
		const [stored] = await service.get('u1')
		assert.equal(stored.htmlUrl, 'https://www.youtube.com/channel/UC1')
	})

	test('destroy removes the stored file', async () => {
		await service.save('u1', [channel('UC1', 'Alpha', { selected: true })])
		assert.equal(await service.destroy('u1'), true)
		assert.deepEqual(await service.get('u1'), [])
	})

	test('destroy reports false when there is nothing to remove', async () => {
		assert.equal(await service.destroy('nobody'), false)
	})
})

describe('ChannelService.merge', () => {
	test('starts every channel unselected for a brand new user', async () => {
		const merged = await service.merge('new-user', [channel('UC1', 'Alpha'), channel('UC2', 'Beta')])
		assert.deepEqual(merged.map(c => c.selected), [false, false])
	})

	test('preserves the stored selection for a channel that is still subscribed', async () => {
		await service.save('u1', [channel('UC1', 'Alpha', { selected: true })])
		const merged = await service.merge('u1', [channel('UC1', 'Alpha')])
		assert.equal(merged.length, 1)
		assert.equal(merged[0].selected, true)
	})

	test('adds a newly discovered channel as unselected', async () => {
		await service.save('u1', [channel('UC1', 'Alpha', { selected: true })])
		const merged = await service.merge('u1', [channel('UC1', 'Alpha'), channel('UC2', 'Beta')])
		const byId = Object.fromEntries(merged.map(c => [c.id, c]))
		assert.equal(byId.UC1.selected, true)
		assert.equal(byId.UC2.selected, false)
	})

	test('drops a stored channel the user is no longer subscribed to', async () => {
		await service.save('u1', [
			channel('UC1', 'Alpha', { selected: true }),
			channel('UC2', 'Beta', { selected: true }),
		])
		const merged = await service.merge('u1', [channel('UC1', 'Alpha')])
		assert.deepEqual(merged.map(c => c.id), ['UC1'])
	})

	test('treats a stored channel with no selected flag as selected', async () => {
		await service.save('u1', [{ id: 'UC1', title: 'Alpha', feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC1' }])
		const merged = await service.merge('u1', [channel('UC1', 'Alpha')])
		assert.equal(merged[0].selected, true)
	})

	// Reporting an empty list here is dangerous: the caller saves whatever merge
	// returns, so a bad fetch would silently overwrite the user's stored
	// channels and selections. Failing loudly leaves the stored file untouched.
	test('throws when the fresh list is not an array', async () => {
		await service.save('u1', [channel('UC1', 'Alpha', { selected: true })])
		await assert.rejects(() => service.merge('u1', null))
	})

	test('leaves the stored file untouched when merge fails', async () => {
		await service.save('u1', [channel('UC1', 'Alpha', { selected: true })])
		await service.merge('u1', undefined).catch(() => {})
		const stored = await service.get('u1')
		assert.equal(stored.length, 1)
		assert.equal(stored[0].selected, true)
	})

	test('removes every stored channel when the fresh list is empty', async () => {
		await service.save('u1', [channel('UC1', 'Alpha', { selected: true })])
		assert.deepEqual(await service.merge('u1', []), [])
	})

	test('updates the title of a channel it already knows about', async () => {
		await service.save('u1', [channel('UC1', 'Old Name', { selected: true })])
		const merged = await service.merge('u1', [channel('UC1', 'New Name')])
		assert.equal(merged[0].title, 'New Name')
	})

	test('keeps the user selection when refreshing a channel', async () => {
		await service.save('u1', [channel('UC1', 'Old Name', { selected: true })])
		const merged = await service.merge('u1', [channel('UC1', 'New Name')])
		assert.equal(merged[0].selected, true)
	})

	test('keeps a deselected channel deselected when refreshing it', async () => {
		await service.save('u1', [channel('UC1', 'Old Name', { selected: false })])
		const merged = await service.merge('u1', [channel('UC1', 'New Name')])
		assert.equal(merged[0].selected, false)
	})

	test('refreshes the other metadata youtube supplies', async () => {
		await service.save('u1', [channel('UC1', 'Alpha', { selected: true, thumbnail: 'https://img/old.jpg' })])
		const merged = await service.merge('u1', [channel('UC1', 'Alpha', { thumbnail: 'https://img/new.jpg' })])
		assert.equal(merged[0].thumbnail, 'https://img/new.jpg')
	})
})
