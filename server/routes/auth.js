const express = require('express');
const jwt = require('jsonwebtoken');
const { bcrypt } = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

// Limiteur simple de tentatives : 20 / 15 min / IP
const fenetreMs = 15 * 60 * 1000;
const maxTentatives = 20;
const tentatives = new Map();
function rateLimitLogin(req, res, next) {
    const ip = req.ip || req.socket.remoteAddress || 'inconnu';
    const now = Date.now();
    const rec = tentatives.get(ip);
    if (!rec || now - rec.t0 > fenetreMs) tentatives.set(ip, { t0: now, c: 0 });
    const r = tentatives.get(ip);
    if (r.c >= maxTentatives) {
        return res.status(429).json({ error: 'Trop de tentatives de connexion, réessayez plus tard' });
    }
    r.c++;
    next();
}

router.post('/login', rateLimitLogin, (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const mot_de_passe = String(req.body.mot_de_passe || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Adresse email invalide' });
    }
    if (!mot_de_passe) {
        return res.status(400).json({ error: 'Mot de passe requis' });
    }
    db.get('SELECT * FROM utilisateur WHERE email = ?', email)
        .then((u) => {
            if (!u || !bcrypt.compareSync(mot_de_passe, u.mot_de_passe)) {
                return res.status(401).json({ error: 'Identifiants incorrects' });
            }
            const token = jwt.sign(
                { id: u.id, nom: u.nom, email: u.email, role: u.role },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );
            res.json({ token, user: { id: u.id, nom: u.nom, email: u.email, role: u.role } });
        })
        .catch(e => {
            console.error(e);
            res.status(500).json({ error: 'Erreur interne du serveur' });
        });
});

module.exports = router;