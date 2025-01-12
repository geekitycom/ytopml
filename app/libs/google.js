import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'

import { config } from '../config.js'
import { logger } from '../logger.js'

function oauth2Factory(tokens) {
  const oauth2 = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    `${config.oidc.issuerBaseUrl}/auth/callback`,
  )

  if (tokens) {
    oauth2.setCredentials(tokens)
  }

  return oauth2
}

export class GoogleProvider {
  constructor() {
    logger.debug('new GoogleProvider');
    this.oauth2 = oauth2Factory()
    this.lastChecked = {}
  }

  destroy(id) {
    delete this.lastChecked[id]
  }

  getAuthorizationUrl(state) {
    return this.oauth2.generateAuthUrl({
      // 'online' (default) or 'offline' (gets refresh_token)
      access_type: 'offline',
      scope: config.google.scope,
      include_granted_scopes: true,
      state: state,
    })
  }

  async getTokens(code) {
    const { tokens } = await this.oauth2.getToken(code);
    return tokens
  }

  async getUserInfo(tokens) {
    const client = new OAuth2Client(config.google.clientId);

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: config.google.clientId,
    });

    return ticket.getPayload();
  }

  async getChannels(tokens) {
    let channels = []
    let pageToken = ''

    const user = await this.getUserInfo(tokens)
    const lastChecked = this.lastChecked[user.sub] ?? 0

    if (lastChecked > Date.now() - config.google.rateLimit) {
      logger.debug(`Rate limit exceeded for ${user.sub}: ${lastChecked}`);
      throw new Error('Rate limit exceeded')
    }

    const youtube = google.youtube({ 
      version: 'v3', 
      auth: oauth2Factory(tokens),
    })
    
    try {
      do {
        const params = {
          part: 'snippet',
          mine: true,
          maxResults: 50,
        };

        if (pageToken) {
          params.pageToken = pageToken
        }

        const response = await youtube.subscriptions.list(params)

        channels = [...channels, ...response.data.items.map((channel) => ({
          id: channel?.id,
          title: channel?.snippet?.title,
          description: channel?.snippet?.description,
          thumbnail: channel?.snippet?.thumbnails?.default?.url,
          feedUrl: `https://www.youtube.com/feeds/videos.xml?channel_id=${channel?.snippet?.resourceId?.channelId}`,
        }))];

        pageToken = response.data.nextPageToken;
      } while (pageToken)

      this.lastChecked[user.sub] = Date.now()

      // Sort channels alphabetically by title
      return channels.sort((a, b) => 
        a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
      );
    } catch (error) {
      console.debug('tokens', { tokens })
      console.error('Error fetching subscriptions:', error)
      throw error
    }
  }
}