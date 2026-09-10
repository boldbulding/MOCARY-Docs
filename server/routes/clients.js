const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', async (req, res, next) => {
    try {
        const params = [];
        let where = 'WHERE 1=1';
        if (req.query.type) { params.push(req.query.type); where += ' AND type_client = ?'; }
        if (req.query.search) { params.push('%' + req.query.search + '%'); where += ' AND nom LIKE ?'; }
        const rows = await db.all(
            `SELECT * FROM client ${where} ORDER BY nom`,
            ...params
        );
        res.json(rows);
    } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
    try {
        const c = await db.get('SELECT * FROM client WHERE id = ?', parseInt(req.params.id, 10));
        if (!c) return res.status(404).json({ error: 'Client non trouvé' });
        res.json(c);
    } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
    try {
        const { nom, type_client, adresse, ville, ice, telephone, email } = req.body;
        if (!nom || !String(nom).trim()) return res.status(400).json({ error: 'Le nom est requis' });
        const type = type_client === 'revendeur' ? 'revendeur' : 'particulier';
        const result = await db.run(
            `INSERT INTO client (nom, type_client, adresse, ville, ice, telephone, email)
             VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
            String(nom).trim(), type, adresse || '', ville || '', ice || '', telephone || '', email || ''
        );
        res.status(201).json({ id: Number(result.lastInsertRowid) });
    } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
    try {
        const id = parseInt(req.params.id, 10);
        const c = await db.get('SELECT * FROM client WHERE id = ?', id);
        if (!c) return res.status(404).json({ error: 'Client non trouvé' });
        const { nom, type_client, adresse, ville, ice, telephone, email } = req.body;
        const type = type_client === 'revendeur' ? 'revendeur' : 'particulier';
        await db.run(
            `UPDATE client SET nom = ?, type_client = ?, adresse = ?, ville = ?, ice = ?, telephone = ?, email = ?
             WHERE id = ?`,
            nom !== undefined ? String(nom).trim() : c.nom,
            type,
            adresse !== undefined ? adresse : c.adresse,
            ville !== undefined ? ville : c.ville,
            ice !== undefined ? ice : c.ice,
            telephone !== undefined ? telephone : c.telephone,
            email !== undefined ? email : c.email,
            id
        );
        res.json({ message: 'Client mis à jour' });
    } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
    try {
        const id = parseInt(req.params.id, 10);
        const c = await db.get('SELECT * FROM client WHERE id = ?', id);
        if (!c) return res.status(404).json({ error: 'Client non trouvé' });
        await db.run('DELETE FROM client WHERE id = ?', id);
        res.json({ message: 'Client supprimé' });
    } catch (e) { next(e); }
});

module.exports = router;