import { create } from 'xmlbuilder2';
import { config } from '../config.js'
import { logger } from '../logger.js'

const SOURCE_NS = 'https://source.scripting.com/';

export function toOpml(channels) {
	const selectedChannels = channels.filter(channel => channel.selected);
	logger.debug('toOpml', { selectedChannels })

	const root = create({ version: '1.0', encoding: 'UTF-8' })
		.ele('opml', { version: '1.0', 'xmlns:source': SOURCE_NS });

	const head = root.ele('head');
	head.ele('title').txt('YouTube Subscriptions').up();

	// rssCloud: subscribers register with this server to be told the moment
	// this list changes, instead of polling. See https://source.scripting.com/
	if (config.rsscloud.active) {
		head.ele('source:cloud').txt(config.rsscloud.pleaseNotifyUrl).up();
	}

	const doc = root.ele('body');

	selectedChannels.forEach(channel => {
		const channelId = channel.feedUrl.split('channel_id=')[1];
		doc.ele('outline', {
			text: channel.title,
			title: channel.title,
			type: 'rss',
			xmlUrl: channel.feedUrl,
			htmlUrl: `https://www.youtube.com/channel/${channelId}`
		});
	});

	return root.end({ prettyPrint: true });
}
