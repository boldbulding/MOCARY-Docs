require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = require('crypto').randomBytes(48).toString('hex');
    console.warn('ATTENTION : JWT_SECRET non défini, secret temporaire généré. Les sessions seront réinitialisées à chaque redémarrage.');
}

const auth = require('./middleware/auth').auth;

const app = express();
const PORT = process.env.PORT || 4000;

(async () => {
    try {
        await db.init();
        await db.ensureAdmin();
        await db.ensureMocary();
        await db.ensureProduction();
    } catch (e) {
        console.error('Erreur de connexion à la base de données :', e.message);
        process.exit(1);
    }

    app.disable('x-powered-by');
    app.use(cors());
    app.use(express.json({ limit: '1mb' }));
    app.use(express.static(path.join(__dirname, '../public'), {
        setHeaders: (res) => { res.setHeader('Cache-Control', 'no-cache, must-revalidate'); }
    }));

    app.use('/api/auth', require('./routes/auth'));
    app.use('/api/documents', auth, require('./routes/documents'));
    app.use('/api/clients', auth, require('./routes/clients'));

    app.use('/api', (req, res) => {
        res.status(404).json({ error: 'Route non trouvée' });
    });

    app.use((err, req, res, next) => {
        if (res.headersSent) return next(err);
        if (err && err.type === 'entity.parse.failed') {
            return res.status(400).json({ error: 'Données JSON invalides' });
        }
        if (db.isUniqueError && db.isUniqueError(err)) {
            return res.status(400).json({ error: 'Cette valeur existe déjà' });
        }
        console.error(err);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    });

    app.listen(PORT, () => {
        console.log(`MOCARY Docs démarré sur http://localhost:${PORT} (base: ${db.USE_PG ? 'PostgreSQL' : 'SQLite'})`);
    });;
})();