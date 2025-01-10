export class SqliteStore {
  constructor(db, tableName = 'sessions') {
    this.db = db
    this.tableName = tableName
    const query = db.prepare(`CREATE TABLE IF NOT EXISTS ${ tableName } (id TEXT PRIMARY KEY, data TEXT)`)
    query.run()
  }

  getSessionById(sessionId) {
    const query = this.db.prepare(`SELECT data FROM ${ this.tableName } WHERE id = $id`)
    const result = query.get({ id: sessionId })
    
    if (result) {
      return JSON.parse(result.data)
    } else {
      return null
    }
  }

  createSession(sessionId, initialData) {
    const query = this.db.prepare(`INSERT INTO ${ this.tableName } (id, data) VALUES ($id, $data)`)
    query.run({ id: sessionId, data: JSON.stringify(initialData) })
  }

  deleteSession(sessionId) {
    const query = this.db.prepare(`DELETE FROM ${ this.tableName } WHERE id = $id`)
    query.run({ id: sessionId})
  }

  persistSessionData(sessionId, sessionData) {
    const query = this.db.prepare(`UPDATE ${ this.tableName } SET data = $data WHERE id = $id`)
    query.run({ id: sessionId, data: JSON.stringify(sessionData) })
  }
}