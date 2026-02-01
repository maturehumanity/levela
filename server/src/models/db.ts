import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '../../levela.db');
export const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

export function initializeDatabase() {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      bio TEXT,
      avatar_url TEXT,
      is_verified INTEGER DEFAULT 0,
      is_admin INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // Endorsements table
  db.exec(`
    CREATE TABLE IF NOT EXISTS endorsements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rater_id INTEGER NOT NULL,
      ratee_id INTEGER NOT NULL,
      pillar TEXT NOT NULL CHECK(pillar IN ('education', 'culture', 'responsibility', 'environment', 'economy')),
      stars INTEGER NOT NULL CHECK(stars >= 1 AND stars <= 5),
      comment TEXT,
      is_hidden INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (rater_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (ratee_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create index for endorsement lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_endorsements_ratee_pillar 
    ON endorsements(ratee_id, pillar, created_at)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_endorsements_rater_ratee_pillar 
    ON endorsements(rater_id, ratee_id, pillar)
  `);

  // Evidence table
  db.exec(`
    CREATE TABLE IF NOT EXISTS evidence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      pillar TEXT NOT NULL CHECK(pillar IN ('education', 'culture', 'responsibility', 'environment', 'economy')),
      title TEXT NOT NULL,
      description TEXT,
      file_uri TEXT,
      file_type TEXT,
      visibility TEXT NOT NULL CHECK(visibility IN ('public', 'private')) DEFAULT 'public',
      endorsement_id INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (endorsement_id) REFERENCES endorsements(id) ON DELETE SET NULL
    )
  `);

  // Reports table
  db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reporter_id INTEGER NOT NULL,
      reported_user_id INTEGER,
      reported_endorsement_id INTEGER,
      reason TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL CHECK(status IN ('pending', 'reviewed', 'resolved')) DEFAULT 'pending',
      admin_notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reported_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reported_endorsement_id) REFERENCES endorsements(id) ON DELETE CASCADE
    )
  `);

  console.log('Database initialized successfully');
}

export function resetDatabase() {
  db.exec(`DROP TABLE IF EXISTS reports`);
  db.exec(`DROP TABLE IF EXISTS evidence`);
  db.exec(`DROP INDEX IF EXISTS idx_endorsements_ratee_pillar`);
  db.exec(`DROP INDEX IF EXISTS idx_endorsements_rater_ratee_pillar`);
  db.exec(`DROP TABLE IF EXISTS endorsements`);
  db.exec(`DROP TABLE IF EXISTS users`);
  console.log('Database reset successfully');
  initializeDatabase();
}
