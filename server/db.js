const path = require('path');
const fs = require('fs');

// PostgreSQL si DATABASE_URL est défini (production Render), sinon SQLite (local, intégré à Node)
const USE_PG = !!(process.env.DATABASE_URL);

let conn = null;

function ddl(kind) {
    const isPg = kind === 'pg';
    const id = isPg ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
    const ts = isPg ? 'TIMESTAMPTZ DEFAULT now()' : 'TEXT DEFAULT CURRENT_TIMESTAMP';

    const client = `CREATE TABLE IF NOT EXISTS client (
    id ${id},
    nom TEXT NOT NULL,
    type_client TEXT NOT NULL DEFAULT 'particulier' CHECK(type_client IN ('particulier','revendeur')),
    adresse TEXT DEFAULT '',
    ville TEXT DEFAULT '',
    ice TEXT DEFAULT '',
    telephone TEXT DEFAULT '',
    email TEXT DEFAULT ''
);`;

    const document = `CREATE TABLE IF NOT EXISTS document (
    id ${id},
    type TEXT NOT NULL CHECK(type IN ('devis','facture')),
    numero TEXT NOT NULL UNIQUE,
    date_doc TEXT NOT NULL,
    client_type TEXT NOT NULL DEFAULT 'particulier' CHECK(client_type IN ('particulier','revendeur')),
    client_nom TEXT DEFAULT '',
    client_ice TEXT DEFAULT '',
    client_adresse TEXT DEFAULT '',
    total_dhs DOUBLE PRECISION NOT NULL DEFAULT 0,
    montant_lettres TEXT DEFAULT '',
    etat TEXT NOT NULL DEFAULT 'brouillon' CHECK(etat IN ('brouillon','emise','validee','annulee')),
    mention INTEGER NOT NULL DEFAULT 0,
    tva DOUBLE PRECISION NOT NULL DEFAULT 0,
    qualite TEXT DEFAULT '',
    remarque TEXT DEFAULT '',
    date_creation ${ts}
);`;

    const ligne = `CREATE TABLE IF NOT EXISTS document_ligne (
    id ${id},
    doc_id INTEGER NOT NULL REFERENCES document(id) ON DELETE CASCADE,
    designation TEXT NOT NULL,
    type_ligne TEXT DEFAULT '',
    qte INTEGER NOT NULL DEFAULT 1,
    longueur DOUBLE PRECISION NOT NULL DEFAULT 0,
    largeur DOUBLE PRECISION NOT NULL DEFAULT 0,
    surface DOUBLE PRECISION NOT NULL DEFAULT 0,
    nb_pieces INTEGER NOT NULL DEFAULT 1,
    unite TEXT NOT NULL DEFAULT 'm2' CHECK(unite IN ('m2','piece')),
    pu_particulier DOUBLE PRECISION NOT NULL DEFAULT 0,
    pu_revendeur DOUBLE PRECISION NOT NULL DEFAULT 0,
    montant DOUBLE PRECISION NOT NULL DEFAULT 0
);`;

    const utilisateur = `CREATE TABLE IF NOT EXISTS utilisateur (
    id ${id},
    nom TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    mot_de_passe TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'employe' CHECK(role IN ('admin','responsable','employe')),
    date_creation ${ts}
);`;

    const indexes = `CREATE INDEX IF NOT EXISTS idx_ligne_doc ON document_ligne(doc_id);
CREATE INDEX IF NOT EXISTS idx_doc_numero ON document(numero);`;

    return [client, document, ligne, utilisateur, indexes];
}

async function init() {
    if (USE_PG) {
        const { Pool } = require('pg');
        conn = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });
        for (const stmt of ddl('pg')) {
            await conn.query(stmt);
        }
    } else {
        const { DatabaseSync } = require('node:sqlite');
        const dataDir = path.join(__dirname, '..', 'data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        const db = new DatabaseSync(path.join(dataDir, 'mocary.db'));
        db.exec('PRAGMA journal_mode = WAL;');
        db.exec('PRAGMA foreign_keys = ON;');
        for (const stmt of ddl('sqlite')) {
            db.exec(stmt);
        }
        conn = {
            all: (sql, ...p) => db.prepare(sql).all(...p),
            get: (sql, ...p) => db.prepare(sql).get(...p),
            run: (sql, ...p) => ({ lastInsertRowid: db.prepare(sql).run(...p).lastInsertRowid })
        };
    }
}

// Convertit `?` (sqlite) en `$1, $2...` (PostgreSQL)
function toPg(sql, params) {
    let i = 0;
    const converted = sql.replace(/\?/g, () => '$' + (++i));
    return { sql: converted, params };
}

function isUniqueError(e) {
    if (!e) return false;
    return e.code === '23505' || /UNIQUE constraint failed/i.test(String(e.message));
}

async function all(sql, ...params) {
    if (USE_PG) {
        const { sql: s, params: p } = toPg(sql, params);
        const r = await conn.query(s, p);
        return r.rows;
    }
    return conn.all(sql, ...params);
}

async function get(sql, ...params) {
    if (USE_PG) {
        const { sql: s, params: p } = toPg(sql, params);
        const r = await conn.query(s, p);
        return r.rows[0] || null;
    }
    return conn.get(sql, ...params);
}

async function run(sql, ...params) {
    if (USE_PG) {
        const { sql: s, params: p } = toPg(sql, params);
        const r = await conn.query(s, p);
        const row = r.rows && r.rows[0];
        return { lastInsertRowid: row ? Number(row.id) : -1 };
    }
    return conn.run(sql, ...params);
}

// Crée le compte administrateur par défaut si aucun utilisateur n'existe.
// Identifiants: ADMIN_EMAIL/ADMIN_PASSWORD (.env) sinon admin@example.com / admin123
async function ensureAdmin() {
    const email = String(process.env.ADMIN_EMAIL || 'admin@example.com').trim().toLowerCase();
    const motDePasse = process.env.ADMIN_PASSWORD || 'admin123';
    const existing = await get('SELECT id FROM utilisateur WHERE email = ?', email);
    if (existing) return existing;
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync(motDePasse, 10);
    await run(
        "INSERT INTO utilisateur (nom, email, mot_de_passe, role) VALUES (?, ?, ?, 'admin')",
        'Administrateur', email, hash
    );
    return await get('SELECT id FROM utilisateur WHERE email = ?', email);
}

module.exports = { init, all, get, run, isUniqueError, USE_PG, ensureAdmin };