import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { toOpml } from '../app/libs/opml.js'

// toOpml takes the cloud endpoint as an argument, so these tests need no
// configuration and no global state.
const CLOUD_URL = 'https://rpc.rsscloud.io/pleaseNotify'

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
		const xml = toOpml([channel('UC1', 'Alpha', true)], CLOUD_URL)
		assert.match(xml, /<opml version="1\.0" xmlns:source="https:\/\/source\.scripting\.com\/">/)
	})

	test('advertises the cloud url it is given', () => {
		const xml = toOpml([channel('UC1', 'Alpha', true)], 'https://cloud.example.com/pleaseNotify')
		assert.match(xml, /<source:cloud>https:\/\/cloud\.example\.com\/pleaseNotify<\/source:cloud>/)
	})

	test('omits the cloud element when given no url', () => {
		const xml = toOpml([channel('UC1', 'Alpha', true)])
		assert.doesNotMatch(xml, /source:cloud/)
		// The list itself must still be served.
		assert.match(xml, /<outline /)
	})

	test('omits the cloud element when given null', () => {
		assert.doesNotMatch(toOpml([channel('UC1', 'Alpha', true)], null), /source:cloud/)
	})

	test('keeps the head well formed when the cloud element is omitted', () => {
		const xml = toOpml([])
		assert.match(xml, /<head>\s*<title>YouTube Subscriptions<\/title>\s*<\/head>/)
	})

	test('excludes channels that are not selected', () => {
		const xml = toOpml([
			channel('UC1', 'Included', true),
			channel('UC2', 'Excluded', false),
		], CLOUD_URL)
		assert.match(xml, /Included/)
		assert.doesNotMatch(xml, /Excluded/)
	})

	test('escapes markup characters in channel titles', () => {
		const xml = toOpml([channel('UC1', 'Tom & Jerry <Live>', true)], CLOUD_URL)
		assert.match(xml, /text="Tom &amp; Jerry &lt;Live&gt;"/)
		// The raw ampersand must never reach the document.
		assert.doesNotMatch(xml, /Tom & Jerry/)
	})

	test('derives the channel page url from the feed url', () => {
		const xml = toOpml([channel('UCabc123', 'Alpha', true)], CLOUD_URL)
		assert.match(xml, /htmlUrl="https:\/\/www\.youtube\.com\/channel\/UCabc123"/)
	})

	test('produces a valid document for an empty subscription list', () => {
		const xml = toOpml([], CLOUD_URL)
		assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/)
		assert.match(xml, /<body\/>|<body>\s*<\/body>/)
		assert.doesNotMatch(xml, /<outline/)
	})
})

// pingIfChanged decides whether to notify the cloud server by comparing
// rendered OPML, so that comparison has to be stable for unchanged input and
// sensitive to anything that alters the published file.
describe('toOpml output stability (what gates an rssCloud ping)', () => {
	const base = [channel('UC1', 'Alpha', true), channel('UC2', 'Beta', false)]
	const render = channels => toOpml(channels, CLOUD_URL)

	test('identical input renders byte-identical output', () => {
		assert.equal(render(base), render([channel('UC1', 'Alpha', true), channel('UC2', 'Beta', false)]))
	})

	test('discovering a new unselected channel does not change the output', () => {
		assert.equal(render(base), render([...base, channel('UC3', 'Gamma', false)]))
	})

	test('selecting a channel changes the output', () => {
		assert.notEqual(render(base), render([channel('UC1', 'Alpha', true), channel('UC2', 'Beta', true)]))
	})

	test('deselecting every channel changes the output', () => {
		assert.notEqual(render(base), render([channel('UC1', 'Alpha', false), channel('UC2', 'Beta', false)]))
	})

	test('renaming a selected channel changes the output', () => {
		assert.notEqual(render(base), render([channel('UC1', 'Alpha Renamed', true), channel('UC2', 'Beta', false)]))
	})

	test('emptying the list changes the output', () => {
		assert.notEqual(render(base), render([]))
	})
})
