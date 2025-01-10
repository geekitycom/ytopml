import { create } from 'xmlbuilder2';
import { logger } from '../logger.js'

export function toOpml(channels) {
	const selectedChannels = channels.filter(channel => channel.selected);
	logger.debug('toOpml', { selectedChannels })
	
	const doc = create({ version: '1.0', encoding: 'UTF-8' })
		.ele('opml', { version: '1.0' })
			.ele('head')
				.ele('title').txt('YouTube Subscriptions').up()
			.up()
			.ele('body');

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

	return doc.end({ prettyPrint: true });
}