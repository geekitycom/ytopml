import { Hono } from 'hono'
import { sessionMiddleware } from 'hono-sessions'
import { SqliteStore } from './libs/sqlite-store.js'
import Database from 'better-sqlite3'
import fs from 'fs'

import { createAuthRouter } from './routes/auth.js'
import { createDashboardRouter } from './routes/dashboard.js'

import { ChannelService } from './libs/channels.js'
import { GoogleProvider } from './libs/google.js'

const app = new Hono()

fs.mkdirSync('./data', { recursive: true })

const channels = new ChannelService('./data/')
const google = new GoogleProvider()

const db = new Database('data/sessions.db')
const store = new SqliteStore(db)

app.use('*', sessionMiddleware({ store }))

app.route('/auth', createAuthRouter(google))
app.route('/', createDashboardRouter(google, channels))

export default app
