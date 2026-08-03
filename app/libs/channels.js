import { readFile, writeFile, unlink } from 'node:fs/promises'
import { resolve } from 'node:path'

import { logger } from '../logger.js'

function channelIndex(channels) {
	return channels.reduce((acc, channel) => {
		if (null == channel.selected) {
			channel.selected = true
		}
		// Backfill htmlUrl from feedUrl for existing channels
		if (!channel.htmlUrl && channel.feedUrl) {
			const channelId = channel.feedUrl.split('channel_id=')[1]
			if (channelId) {
				channel.htmlUrl = `https://www.youtube.com/channel/${channelId}`
			}
		}
		acc[channel.id] = channel
		acc._delete.add(channel.id)
		return acc
	}, { _delete: new Set() });
}

function mergeChannel(index, channel) {
	if (index._delete.has(channel.id)) {
		index._delete.delete(channel.id)
		// Already subscribed: take the fresh metadata from YouTube, since titles
		// and thumbnails change, but keep whatever the user chose to publish.
		index[channel.id] = { ...channel, selected: index[channel.id].selected }
	} else {
		index[channel.id] = channel
		index[channel.id].selected = false
	}
}

export class ChannelService {
	constructor(dataDir) {
		this.dataDir = dataDir
	}

	async get(id) {
		try {
			if (null == id) {
				throw new Error('id is required')
			}
			const filename = resolve(this.dataDir, `${id}.json`)
			const channels = JSON.parse(await readFile(filename, 'utf8'))
			// Backfill htmlUrl for existing channels
			channels.forEach(channel => {
				if (!channel.htmlUrl && channel.feedUrl) {
					const channelId = channel.feedUrl.split('channel_id=')[1]
					if (channelId) {
						channel.htmlUrl = `https://www.youtube.com/channel/${channelId}`
					}
				}
			})
			return channels
		} catch (error) {
			if (error.code !== 'ENOENT') {
				logger.error(error)
			}
			return []
		}
	}

	// Errors deliberately propagate. The caller saves whatever this returns, so
	// quietly reporting an empty list on failure would overwrite the user's
	// stored channels and their selections. Throwing leaves the file untouched.
	async merge(id, fresh) {
		if (!Array.isArray(fresh)) {
			throw new TypeError('merge requires an array of fresh channels')
		}

		const channels = await this.get(id)
		const index = channelIndex(channels)
		fresh.forEach(mergeChannel.bind(null, index));
		index._delete.forEach((id) => {
			delete index[id]
		})
		delete index._delete
		return Object.values(index)
	}

	async save(id, channels) {
		try {
			const filename = resolve(this.dataDir, `${id}.json`)
			await writeFile(filename, JSON.stringify(channels, null, 2), 'utf8')
			return channels
		} catch (error) {
			logger.error(error)
			return []
		}
	}

	async destroy(id) {
		try {
			const filename = resolve(this.dataDir, `${id}.json`)
			await unlink(filename)
			return true
		} catch (error) {
			logger.error(error)
			return false
		}
	}
}