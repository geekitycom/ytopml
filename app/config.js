import crypto from 'crypto';

// Unlike dotenv.config(), loadEnvFile throws when there is no .env — which is
// the normal case in Docker, where the environment is supplied by compose.
try {
  process.loadEnvFile();
} catch (error) {
  if (error.code !== 'ENOENT') {
    throw error;
  }
}

// The cloud server has to fetch our OPML to notify subscribers, so a
// non-routable issuer URL (local dev) means there is nothing to advertise.
function isReachable(issuerBaseUrl) {
  if (!issuerBaseUrl) {
    return false;
  }
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(issuerBaseUrl) === false;
}

export function createConfig(env = process.env) {
  const config = {
    site: {
      name: env.SITE_NAME ?? 'YT OPML',
      description: env.SITE_DESCRIPTION ?? 'Generate an OPML subscription list of your YouTube subscriptions.',
      year: new Date().getFullYear(),
    },
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      scope: ['openid', 'https://www.googleapis.com/auth/youtube.readonly'],
      rateLimit: 300000, // 5 minutes
    },
    oidc: {
      cookieSecret: env.COOKIE_SECRET ?? crypto.randomBytes(32).toString('hex'),
      issuerBaseUrl: env.OIDC_ISSUER_BASE_URL,
      port: parseInt(env.PORT, 10) || 3000,
      logLevel: env.LOG_LEVEL || 'info',
    },
    rsscloud: {
      enabled: (env.RSSCLOUD_ENABLED ?? 'true') === 'true',
      server: (env.RSSCLOUD_SERVER ?? 'https://rpc.rsscloud.io').replace(/\/+$/, ''),
      timeout: 10000,
    }
  };

  config.rsscloud.reachable = isReachable(config.oidc.issuerBaseUrl);
  config.rsscloud.active = config.rsscloud.enabled && config.rsscloud.reachable;
  config.rsscloud.pleaseNotifyUrl = `${config.rsscloud.server}/pleaseNotify`;
  config.rsscloud.pingUrl = `${config.rsscloud.server}/ping`;

  return config;
}

export const config = createConfig();
