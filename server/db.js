/**
 * SQLite adapter using node-sqlite3-wasm (pure WebAssembly, no native build needed).
 * Exposes the same synchronous better-sqlite3 API used throughout the route files:
 *   db.prepare(sql).run(...args)
 *   db.prepare(sql).get(...args)
 *   db.prepare(sql).all(...args)
 *   db.exec(sql)
 *   db.transaction(fn)()
 */
const { Database } = require('node-sqlite3-wasm');
const path = require('path');
const fs = require('fs');
const config = require('./config');

const dbPath = path.resolve(__dirname, config.dbPath);
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const _db = new Database(dbPath);

// Normalize arguments: better-sqlite3 accepts both spread args and arrays
function normalizeParams(args) {
  if (args.length === 0) return undefined;
  if (args.length === 1 && Array.isArray(args[0])) return args[0];
  if (args.length === 1 && args[0] !== null && typeof args[0] === 'object' && !Array.isArray(args[0])) {
    return args[0];
  }
  return args;
}

class Statement {
  constructor(sql) {
    this._sql = sql;
  }

  run(...args) {
    return _db.run(this._sql, normalizeParams(args));
  }

  get(...args) {
    return _db.get(this._sql, normalizeParams(args));
  }

  all(...args) {
    return _db.all(this._sql, normalizeParams(args));
  }
}

const db = {
  prepare(sql) {
    return new Statement(sql);
  },

  exec(sql) {
    return _db.exec(sql);
  },

  transaction(fn) {
    return (...args) => {
      _db.run('BEGIN');
      try {
        const result = fn(...args);
        _db.run('COMMIT');
        return result;
      } catch (e) {
        _db.run('ROLLBACK');
        throw e;
      }
    };
  },
};

// Apply schema
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// Migrations: add new columns to existing tables without breaking existing data
const migrations = [
  'ALTER TABLE tickets ADD COLUMN category TEXT',
  'ALTER TABLE tickets ADD COLUMN subcategory TEXT',
];
for (const sql of migrations) {
  try { _db.run(sql); } catch (_) { /* column already exists */ }
}

module.exports = db;
