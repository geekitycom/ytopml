import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { logger } from '../logger.js'

function channelIndex(channels) {
	return channels.reduce((acc, channel) => {
		if (null == channel.selected) {
			channel.selected = true
		}
		acc[channel.id] = channel
		acc._delete.add(channel.id)
		return acc
	}, { _delete: new Set() });
}

function mergeChannel(index, channel) {
	if (index._delete.has(channel.id)) {
		index._delete.delete(channel.id)
	} else {
		index[channel.id] = channel
		index[channel.id].selected = true
	}
}

export class ChannelService {
	constructor(dataDir) {
		this.dataDir = dataDir
	}

	async get(id) {
		try {
			const filename = resolve(this.dataDir, `${id}.json`)
			return JSON.parse(await readFile(filename, 'utf8'))
		} catch (error) {
			logger.error(error)
			return []
		}
	}

	async merge(id, fresh) {
		try {
			const channels = await this.get(id)
			if (Array.isArray(fresh) && Array.isArray(channels)) {
				const index = channelIndex(channels)
				fresh.forEach(mergeChannel.bind(null, index));
				index._delete.forEach((id) => {
					delete index[id]
				})
				delete index._delete
				return Object.values(index)
			}
			return []
		} catch (error) {
			logger.error(error)
			return []
		}
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
}