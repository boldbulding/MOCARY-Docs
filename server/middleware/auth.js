const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

function auth(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.toLowerCase().startsWith('bearer ')) {
        return res.status(401).json({ error: 'Token manquant' });
    }
    try {
        const token = header.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Token invalide' });
    }
}

function requireAdmin(req, res, next) {
    if (req.user && req.user.role === 'admin') return next();
    return res.status(403).json({ error: 'Accès réservé à l\'administrateur' });
}

module.exports = { auth, requireAdmin, bcrypt };