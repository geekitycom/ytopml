import { config } from '../config.js'

export async function requireUser(c, next) {
  const session = c.get('session')
  const tokens = session?.get('tokens')

  if (tokens && tokens?.expiry_date > Date.now()) {
    await next()
  } else {
    session && session.deleteSession()
    return c.redirect(`${config.oidc.issuerBaseUrl}/`)
  }
}

export async function checkExpires(c, next) {
  const session = c.get('session')
  const tokens = session?.get('tokens')

  if (tokens?.expiry_date <= Date.now()) {
    session && session.deleteSession()
  }

  await next()
}