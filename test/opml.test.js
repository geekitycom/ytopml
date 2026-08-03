import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'

import { config } from '../app/config.js'
import { toOpml } from '../app/libs/opml.js'

// toOpml reads config.rsscloud at call time, so tests drive it by flipping the
// singleton rather than re-importing the module under a different environment.
let savedRsscloud

beforeEach(() => {
	savedRsscloud = { ...config.rsscloud }
	config.rsscloud.active = true
	config.rsscloud.pleaseNotifyUrl = 'https://rpc.rsscloud.io/pleaseNotify'
})

afterEach(() => {
	Object.assign(config.rsscloud, savedRsscloud)
})

function channel(id, title, selected) {
	return {
		id,
		title,
		selected,
		feedUrl: `https://www.youtube.com/feeds/videos.xml?channel_id=${id}`,
	}
}

describe('toOpml', () => {
	test('declares the source namespace on the root element', () => {
		const xml = toOpml([channel('UC1', 'Alpha', true)])
		assert.match(xml, /<opml version="1\.0" xmlns:source="https:\/\/source\.scripting\.com\/">/)
	})

	test('advertises the cloud server in the head when rssCloud is active', () => {
		const xml = toOpml([channel('UC1', 'Alpha', true)])
		assert.match(xml, /<source:cloud>https:\/\/rpc\.rsscloud\.io\/pleaseNotify<\/source:cloud>/)
	})

	test('omits the cloud element when rssCloud is inactive', () => {
		config.rsscloud.active = false
		const xml = toOpml([channel('UC1', 'Alpha', true)])
		assert.doesNotMatch(xml, /source:cloud/)
		// The list itself must still be served.
		assert.match(xml, /<outline /)
	})

	test('keeps the head well formed when the cloud element is omitted', () => {
		config.rsscloud.active = false
		const xml = toOpml([])
		assert.match(xml, /<head>\s*<title>YouTube Subscriptions<\/title>\s*<\/head>/)
	})

	test('excludes channels that are not selected', () => {
		const xml = toOpml([
			channel('UC1', 'Included', true),
			channel('UC2', 'Excluded', false),
		])
		assert.match(xml, /Included/)
		assert.doesNotMatch(xml, /Excluded/)
	})

	test('escapes markup characters in channel titles', () => {
		const xml = toOpml([channel('UC1', 'Tom & Jerry <Live>', true)])
		assert.match(xml, /text="Tom &amp; Jerry &lt;Live&gt;"/)
		// The raw ampersand must never reach the document.
		assert.doesNotMatch(xml, /Tom & Jerry/)
	})

	test('derives the channel page url from the feed url', () => {
		const xml = toOpml([channel('UCabc123', 'Alpha', true)])
		assert.match(xml, /htmlUrl="https:\/\/www\.youtube\.com\/channel\/UCabc123"/)
	})

	test('produces a valid document for an empty subscription list', () => {
		const xml = toOpml([])
		assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/)
		assert.match(xml, /<body\/>|<body>\s*<\/body>/)
		assert.doesNotMatch(xml, /<outline/)
	})
})

// pingIfChanged in routes/dashboard.js decides whether to notify the cloud
// server by comparing rendered OPML, so that comparison has to be stable for
// unchanged input and sensitive to anything that alters the published file.
describe('toOpml output stability (what gates an rssCloud ping)', () => {
	const base = [channel('UC1', 'Alpha', true), channel('UC2', 'Beta', false)]

	test('identical input renders byte-identical output', () => {
		assert.equal(toOpml(base), toOpml([channel('UC1', 'Alpha', true), channel('UC2', 'Beta', false)]))
	})

	test('discovering a new unselected channel does not change the output', () => {
		const withNew = [...base, channel('UC3', 'Gamma', false)]
		assert.equal(toOpml(base), toOpml(withNew))
	})

	test('selecting a channel changes the output', () => {
		const toggled = [channel('UC1', 'Alpha', true), channel('UC2', 'Beta', true)]
		assert.notEqual(toOpml(base), toOpml(toggled))
	})

	test('deselecting every channel changes the output', () => {
		const off = [channel('UC1', 'Alpha', false), channel('UC2', 'Beta', false)]
		assert.notEqual(toOpml(base), toOpml(off))
	})

	test('renaming a selected channel changes the output', () => {
		const renamed = [channel('UC1', 'Alpha Renamed', true), channel('UC2', 'Beta', false)]
		assert.notEqual(toOpml(base), toOpml(renamed))
	})

	test('emptying the list changes the output', () => {
		assert.notEqual(toOpml(base), toOpml([]))
	})
})
