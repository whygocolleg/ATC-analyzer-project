const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '..', 'data', 'atc.db');

// Ensure data directory exists
const fs = require('fs');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ──────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT DEFAULT '📁',
    color TEXT DEFAULT '#00ff00',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS analyses (
    id TEXT PRIMARY KEY,
    dialog_text TEXT NOT NULL,
    summary TEXT,
    aircraft_callsign TEXT,
    airport TEXT,
    phase TEXT,
    overall_severity TEXT,
    analysis_json TEXT NOT NULL,
    category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
    source_url TEXT,
    source_type TEXT CHECK(source_type IN ('manual', 'youtube', 'liveatc', 'vasaviation', 'other')),
    title TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    analysis_id TEXT NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    incident_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    dialog_text TEXT,
    educational_note TEXT,
    atc_best_practice TEXT,
    pilot_best_practice TEXT,
    related_regulation TEXT
  );

  CREATE TABLE IF NOT EXISTS study_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    analysis_id TEXT NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    completed INTEGER DEFAULT 0,
    notes TEXT,
    rating INTEGER CHECK(rating BETWEEN 1 AND 5),
    studied_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_analyses_category ON analyses(category_id);
  CREATE INDEX IF NOT EXISTS idx_analyses_airport ON analyses(airport);
  CREATE INDEX IF NOT EXISTS idx_analyses_severity ON analyses(overall_severity);
  CREATE INDEX IF NOT EXISTS idx_incidents_type ON incidents(incident_type);
  CREATE INDEX IF NOT EXISTS idx_incidents_analysis ON incidents(analysis_id);
`);

// ── Seed default categories ─────────────────────────────────────────────────

const defaultCategories = [
  { name: 'Emergency', description: 'Emergency declarations, fuel issues, engine failures', icon: '🚨', color: '#ff2222' },
  { name: 'Runway Incursion', description: 'Unauthorized runway entry, runway conflicts', icon: '🛬', color: '#ff6600' },
  { name: 'Weather', description: 'Weather deviations, wind shear, turbulence', icon: '🌪️', color: '#00aaff' },
  { name: 'Communication', description: 'Readback errors, frequency issues, miscommunication', icon: '📡', color: '#4499ff' },
  { name: 'Separation', description: 'Loss of separation, TCAS alerts, near misses', icon: '⚠️', color: '#ffee00' },
  { name: 'Go-Around', description: 'Missed approaches, go-around procedures', icon: '🔄', color: '#ff8800' },
  { name: 'General Training', description: 'Standard procedures, best practices', icon: '🎓', color: '#00ff00' },
];

const insertCategory = db.prepare(`
  INSERT OR IGNORE INTO categories (id, name, description, icon, color)
  VALUES (?, ?, ?, ?, ?)
`);

for (const cat of defaultCategories) {
  insertCategory.run(uuidv4(), cat.name, cat.description, cat.icon, cat.color);
}

// ── Prepared statements ─────────────────────────────────────────────────────

const stmts = {
  // Analyses
  insertAnalysis: db.prepare(`
    INSERT INTO analyses (id, dialog_text, summary, aircraft_callsign, airport, phase, overall_severity, analysis_json, category_id, source_url, source_type, title)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),

  getAnalysis: db.prepare(`SELECT * FROM analyses WHERE id = ?`),

  listAnalyses: db.prepare(`
    SELECT a.id, a.title, a.summary, a.aircraft_callsign, a.airport, a.phase, a.overall_severity,
           a.source_type, a.category_id, a.created_at,
           c.name as category_name, c.icon as category_icon, c.color as category_color,
           (SELECT COUNT(*) FROM incidents WHERE analysis_id = a.id) as incident_count
    FROM analyses a
    LEFT JOIN categories c ON a.category_id = c.id
    ORDER BY a.created_at DESC
  `),

  listAnalysesByCategory: db.prepare(`
    SELECT a.id, a.title, a.summary, a.aircraft_callsign, a.airport, a.phase, a.overall_severity,
           a.source_type, a.category_id, a.created_at,
           c.name as category_name, c.icon as category_icon, c.color as category_color,
           (SELECT COUNT(*) FROM incidents WHERE analysis_id = a.id) as incident_count
    FROM analyses a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.category_id = ?
    ORDER BY a.created_at DESC
  `),

  deleteAnalysis: db.prepare(`DELETE FROM analyses WHERE id = ?`),

  updateAnalysisCategory: db.prepare(`
    UPDATE analyses SET category_id = ?, updated_at = datetime('now') WHERE id = ?
  `),

  // Incidents
  insertIncident: db.prepare(`
    INSERT INTO incidents (analysis_id, incident_type, severity, title, description, dialog_text, educational_note, atc_best_practice, pilot_best_practice, related_regulation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),

  getIncidentsByAnalysis: db.prepare(`SELECT * FROM incidents WHERE analysis_id = ?`),

  // Categories
  listCategories: db.prepare(`
    SELECT c.*, (SELECT COUNT(*) FROM analyses WHERE category_id = c.id) as analysis_count
    FROM categories c
    ORDER BY c.name
  `),

  insertCategoryStmt: db.prepare(`
    INSERT INTO categories (id, name, description, icon, color) VALUES (?, ?, ?, ?, ?)
  `),

  // Study progress
  upsertProgress: db.prepare(`
    INSERT INTO study_progress (analysis_id, completed, notes, rating)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET completed = ?, notes = ?, rating = ?, studied_at = datetime('now')
  `),

  getProgress: db.prepare(`SELECT * FROM study_progress WHERE analysis_id = ?`),

  // Search
  searchAnalyses: db.prepare(`
    SELECT a.id, a.title, a.summary, a.aircraft_callsign, a.airport, a.overall_severity, a.created_at,
           c.name as category_name, c.icon as category_icon
    FROM analyses a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.dialog_text LIKE ? OR a.summary LIKE ? OR a.title LIKE ? OR a.airport LIKE ?
    ORDER BY a.created_at DESC
    LIMIT 50
  `),

  // Stats
  getStats: db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM analyses) as total_analyses,
      (SELECT COUNT(*) FROM incidents) as total_incidents,
      (SELECT COUNT(DISTINCT airport) FROM analyses WHERE airport IS NOT NULL) as airports_covered,
      (SELECT COUNT(*) FROM study_progress WHERE completed = 1) as completed_studies
  `),
};

// ── Public API ──────────────────────────────────────────────────────────────

function saveAnalysis({ dialogText, analysis, sourceUrl, sourceType, title, categoryId }) {
  const id = uuidv4();

  const autoTitle = title || analysis.summary?.slice(0, 80) || `Analysis ${new Date().toISOString().slice(0, 10)}`;

  const saveTransaction = db.transaction(() => {
    stmts.insertAnalysis.run(
      id,
      dialogText,
      analysis.summary || null,
      analysis.aircraftCallsign || null,
      analysis.airport || null,
      analysis.phase || null,
      analysis.overallSeverity || null,
      JSON.stringify(analysis),
      categoryId || null,
      sourceUrl || null,
      sourceType || 'manual',
      autoTitle
    );

    if (analysis.incidents) {
      for (const inc of analysis.incidents) {
        stmts.insertIncident.run(
          id,
          inc.type,
          inc.severity,
          inc.title,
          inc.description || null,
          inc.dialogText || null,
          inc.educationalNote || null,
          inc.atcBestPractice || null,
          inc.pilotBestPractice || null,
          inc.relatedRegulation || null
        );
      }
    }
  });

  saveTransaction();
  return { id, title: autoTitle };
}

function getAnalysis(id) {
  const row = stmts.getAnalysis.get(id);
  if (!row) return null;
  return {
    ...row,
    analysis_json: JSON.parse(row.analysis_json),
  };
}

function listAnalyses(categoryId) {
  if (categoryId) {
    return stmts.listAnalysesByCategory.all(categoryId);
  }
  return stmts.listAnalyses.all();
}

function deleteAnalysis(id) {
  return stmts.deleteAnalysis.run(id);
}

function updateCategory(analysisId, categoryId) {
  return stmts.updateAnalysisCategory.run(categoryId, analysisId);
}

function listCategories() {
  return stmts.listCategories.all();
}

function createCategory({ name, description, icon, color }) {
  const id = uuidv4();
  stmts.insertCategoryStmt.run(id, name, description || null, icon || '📁', color || '#00ff00');
  return { id, name, description, icon, color };
}

function searchAnalyses(query) {
  const pattern = `%${query}%`;
  return stmts.searchAnalyses.all(pattern, pattern, pattern, pattern);
}

function getStats() {
  return stmts.getStats.get();
}

function saveStudyProgress(analysisId, { completed, notes, rating }) {
  const existing = stmts.getProgress.get(analysisId);
  if (existing) {
    stmts.upsertProgress.run(analysisId, completed ? 1 : 0, notes || null, rating || null,
      completed ? 1 : 0, notes || null, rating || null);
  } else {
    db.prepare(`INSERT INTO study_progress (analysis_id, completed, notes, rating) VALUES (?, ?, ?, ?)`)
      .run(analysisId, completed ? 1 : 0, notes || null, rating || null);
  }
}

function getStudyProgress(analysisId) {
  return stmts.getProgress.get(analysisId);
}

module.exports = {
  db,
  saveAnalysis,
  getAnalysis,
  listAnalyses,
  deleteAnalysis,
  updateCategory,
  listCategories,
  createCategory,
  searchAnalyses,
  getStats,
  saveStudyProgress,
  getStudyProgress,
};
