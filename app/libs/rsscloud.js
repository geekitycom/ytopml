import { config } from '../config.js'
import { logger } from '../logger.js'

// Public URL of a user's OPML, which is what subscribers poll and what the
// cloud server re-fetches when we ping it.
export function opmlUrl(sub) {
	return `${config.oidc.issuerBaseUrl}/${sub}.opml`
}

// Only a change to the published OPML is worth a ping — selecting a channel
// that was already selected, or picking up a new unselected subscription,
// leaves the file identical.
//
// before and after are both rendered OPML documents, not channel lists. Callers
// mutate channel objects in place while saving, so a list captured beforehand
// would already reflect the change and nothing would ever look different.
export function pingIfChanged(sub, before, after) {
	if (before === after) {
		return false
	}
	// Deliberately not awaited: the cloud server must not slow down a save.
	ping(sub)
	return true
}

// Tell the cloud server an OPML changed so it can notify subscribers.
// Fire and forget: a cloud that is down or slow must never break a save.
export async function ping(sub) {
	if (!config.rsscloud.active) {
		logger.debug({ message: 'rsscloud ping skipped', sub, enabled: config.rsscloud.enabled, reachable: config.rsscloud.reachable })
		return false
	}

	const url = opmlUrl(sub)

	try {
		const response = await fetch(config.rsscloud.pingUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Accept': 'application/json',
			},
			body: new URLSearchParams({ url }).toString(),
			signal: AbortSignal.timeout(config.rsscloud.timeout),
		})

		// The server answers 200 with success:false for soft failures, so the
		// body matters as much as the status.
		const result = await response.json().catch(() => ({}))

		if (!response.ok || result.success === false) {
			logger.warn({ message: 'rsscloud ping failed', url, status: response.status, msg: result.msg })
			return false
		}

		logger.info({ message: 'rsscloud ping sent', url, msg: result.msg })
		return true
	} catch (error) {
		logger.warn({ message: 'rsscloud ping error', url, error: error.message })
		return false
	}
}
