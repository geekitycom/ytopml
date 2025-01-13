import dotenv from 'dotenv';
import crypto from 'crypto';
dotenv.config();

export const config = {
  site: {
    name: process.env.SITE_NAME ?? 'YT OPML',
    description: process.env.SITE_DESCRIPTION ?? 'Generate an OPML subscription list of your YouTube subscriptions.',
    year: new Date().getFullYear(),
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    scope: ['openid', 'https://www.googleapis.com/auth/youtube.readonly'],
    rateLimit: 300000, // 5 minutes
  },
  oidc: {
    cookieSecret: process.env.COOKIE_SECRET ?? crypto.randomBytes(32).toString('hex'),
    issuerBaseUrl: process.env.OIDC_ISSUER_BASE_URL,
    port: parseInt(process.env.PORT, 10) || 3000,
    logLevel: process.env.LOG_LEVEL || 'info',
  }
};
