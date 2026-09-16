const express = require('express');
const db = require('../db');
const { nombreEnLettres } = require('../utils/nombre-lettres');
const { requireAdmin } = require('../middleware/auth');
const ExcelJS = require('exceljs');

const router = express.Router();

const norm = (s) => parseFloat(String(s).replace(',', '.')) || 0;
const normInt = (s) => Math.round(norm(s));
const arrondi2 = (x) => Math.round(x * 100) / 100;

// Montant d'une ligne : SURF × P.U. avec SURF = QTE × LONG × LARG (ou surface saisie)
function montantLigne(l) {
    const pu = norm(l.pu);
    let surface;
    if ((l.longueur || 0) > 0 && (l.largeur || 0) > 0) surface = (l.longueur || 0) * (l.largeur || 0) * (l.qte || 1);
    else if ((l.surface || 0) > 0) surface = l.surface;
    else surface = 0;
    return arrondi2(surface * pu);
}

// Surface d'une ligne : QTE × LONG × LARG (ou surface saisie)
function surfaceLigne(l) {
    if ((l.longueur || 0) > 0 && (l.largeur || 0) > 0) return arrondi2((l.longueur || 0) * (l.largeur || 0) * (l.qte || 1));
    return arrondi2(norm(l.surface));
}

async function genererNumero(type) {
    const prefix = type === 'devis' ? 'DEV-' : 'FAC-';
    const row = await db.get(
        'SELECT numero FROM document WHERE type = ? AND numero LIKE ? ORDER BY id DESC LIMIT 1',
        type, prefix + '%'
    );
    let suite = 1;
    if (row) {
        const match = String(row.numero).match(/(\d+)\s*$/);
        if (match) suite = parseInt(match[1], 10) + 1;
    }
    return prefix + String(suite).padStart(4, '0');
}

function appliquerTva(base, mention, tvaPct) {
    return (mention === 1 && tvaPct > 0) ? arrondi2(base * (1 + tvaPct / 100)) : base;
}

const TYPES = ['devis', 'facture'];
const ETATS = ['brouillon', 'emise', 'validee', 'annulee'];

// Applique la visibilité : l'admin voit tout, les autres voient uniquement leurs documents
function filtreProprietaire(req, where, params) {
    if (req.user && req.user.role !== 'admin') {
        where += ' AND creator_id = ?';
        params.push(req.user.id);
    }
    return where;
}

// Liste des documents (filtres : type, recherche, etat)
router.get('/', async (req, res, next) => {
    try {
        const params = [];
        let where = 'WHERE 1=1';
        if (req.query.type) { params.push(req.query.type); where += ' AND type = ?'; }
        if (req.query.commercial) {
            const c = '%' + String(req.query.commercial).slice(0, 100) + '%';
            params.push(c);
            where += ' AND client_nom LIKE ?';
        }
        if (req.query.search) {
            const s = '%' + String(req.query.search).slice(0, 100) + '%';
            params.push(s, s, s);
            where += ' AND (numero LIKE ? OR client_nom LIKE ? OR client_ice LIKE ?)';
        }
        if (req.query.etat) { params.push(req.query.etat); where += ' AND etat = ?'; }
        where = filtreProprietaire(req, where, params);
        const rows = await db.all(
            `SELECT * FROM document ${where} ORDER BY date_doc DESC, id DESC`,
            ...params
        );
        res.json(rows);
    } catch (e) { next(e); }
});

// Numéro suivant
router.get('/next', async (req, res, next) => {
    try {
        const type = req.query.type === 'devis' ? 'devis' : 'facture';
        res.json({ numero: await genererNumero(type) });
    } catch (e) { next(e); }
});

// Export Excel des documents
router.get('/excel/list', async (req, res, next) => {
    try {
        const params = [];
        let where = 'WHERE 1=1';
        if (req.query.type) { params.push(req.query.type); where += ' AND type = ?'; }
        if (req.query.commercial) {
            const c = '%' + String(req.query.commercial).slice(0, 100) + '%';
            params.push(c);
            where += ' AND client_nom LIKE ?';
        }
        if (req.query.search) {
            const s = '%' + String(req.query.search).slice(0, 100) + '%';
            params.push(s, s, s);
            where += ' AND (numero LIKE ? OR client_nom LIKE ? OR client_ice LIKE ?)';
        }
        if (req.query.etat) { params.push(req.query.etat); where += ' AND etat = ?'; }
        where = filtreProprietaire(req, where, params);
        const docs = await db.all(
            `SELECT * FROM document ${where} ORDER BY date_doc DESC, id DESC`,
            ...params
        );

        const labels = { brouillon: 'Brouillon', emise: 'Émise', validee: 'Validée', annulee: 'Annulée' };
        const typeLabels = { particulier: 'Particulier', revendeur: 'Revendeur' };
        const POLICE = 'Georgia';

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'MOCARY SA';

        function finale(ws) {
            ws.eachRow((row) => {
                row.eachCell((cell) => {
                    cell.font = Object.assign({ name: POLICE }, cell.font || {});
                    if (typeof cell.value === 'number') cell.numFmt = '0.00';
                });
            });
        }

        const sheet = workbook.addWorksheet('Documents');
        sheet.columns = [
            { header: 'Type', key: 'type', width: 10 },
            { header: 'N°', key: 'numero', width: 16 },
            { header: 'Date', key: 'date_doc', width: 14 },
            { header: 'Client (type)', key: 'client_type', width: 14 },
            { header: 'Client', key: 'client_nom', width: 28 },
            { header: 'ICE', key: 'client_ice', width: 18 },
            { header: 'Total (DHS)', key: 'total_dhs', width: 14 },
            { header: 'État', key: 'etat', width: 12 }
        ];
        sheet.getRow(1).font = { bold: true };
        docs.forEach(d => sheet.addRow({
            type: d.type === 'devis' ? 'DEVIS' : 'FACTURE',
            numero: d.numero, date_doc: d.date_doc,
            client_type: typeLabels[d.client_type] || d.client_type,
            client_nom: d.client_nom || '', client_ice: d.client_ice || '',
            total_dhs: d.total_dhs, etat: labels[d.etat] || d.etat
        }));
        finale(sheet);

        const lig = workbook.addWorksheet('Lignes');
        lig.columns = [
            { header: 'N°', key: 'numero', width: 16 },
            { header: 'Type', key: 'type', width: 10 },
            { header: 'Client', key: 'client_nom', width: 24 },
            { header: 'Désignation', key: 'designation', width: 28 },
            { header: 'TAILLE', key: 'type_ligne', width: 7 },
            { header: 'QTE', key: 'qte', width: 7 },
            { header: 'LONG (m)', key: 'longueur', width: 10 },
            { header: 'LARG (m)', key: 'largeur', width: 10 },
            { header: 'Surf (m²)', key: 'surface', width: 10 },
            { header: 'P.U. Particulier', key: 'pu_particulier', width: 15 },
            { header: 'P.U. Revendeur', key: 'pu_revendeur', width: 15 },
            { header: 'P.U. appliqué', key: 'pu_applique', width: 13 },
            { header: 'Montant', key: 'montant', width: 12 }
        ];
        lig.getRow(1).font = { bold: true };
        for (const d of docs) {
            const lignes = await db.all('SELECT * FROM document_ligne WHERE doc_id = ? ORDER BY id', d.id);
            lignes.forEach(l => lig.addRow({
                numero: d.numero,
                type: d.type === 'devis' ? 'DEVIS' : 'FACTURE',
                client_nom: d.client_nom || '',
                designation: l.designation || '', type_ligne: l.type_ligne || '',
                qte: l.qte, longueur: l.longueur, largeur: l.largeur, surface: l.surface,
                pu_particulier: l.pu_particulier, pu_revendeur: l.pu_revendeur,
                pu_applique: d.client_type === 'revendeur' ? l.pu_revendeur : l.pu_particulier,
                montant: l.montant
            }));
        }
        finale(lig);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=mocary_factures_devis.xlsx');
        await workbook.xlsx.write(res);
        res.end();
    } catch (e) { next(e); }
});

// Détail d'un document avec ses lignes
router.get('/:id', async (req, res, next) => {
    try {
        const id = parseInt(req.params.id, 10);
        const doc = await db.get('SELECT * FROM document WHERE id = ?', id);
        if (!doc) return res.status(404).json({ error: 'Document non trouvé' });
        if (req.user && req.user.role !== 'admin' && Number(doc.creator_id) !== Number(req.user.id)) {
            return res.status(404).json({ error: 'Document non trouvé' });
        }
        const lignes = await db.all('SELECT * FROM document_ligne WHERE doc_id = ? ORDER BY id', id);
        res.json({ ...doc, lignes });
    } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
    try {
        const { type, numero, date_doc, client_type, client_nom, nom_client, client_ice, client_adresse,
                lignes, etat, mention, tva, qualite, remarque, montant_lettres, mode_paiement,
                tisse, noue, hand_tuft, stock } = req.body;
        if (!TYPES.includes(type)) return res.status(400).json({ error: 'Type de document invalide' });
        if (!date_doc) return res.status(400).json({ error: 'La date est requise' });

        const numeroManuel = String(numero || '').trim();
        let finalNumero = numeroManuel || await genererNumero(type);

        const rows = Array.isArray(lignes) ? lignes : [];
        const ct = client_type === 'revendeur' ? 'revendeur' : 'particulier';
        let total = 0;
        rows.forEach(l => {
            total += montantLigne({ ...l, pu: ct === 'revendeur' ? l.pu_revendeur : l.pu_particulier });
        });
        total = arrondi2(total);
        const mentionVal = mention !== undefined ? (mention ? 1 : 0) : 0;
        const tvaPct = norm(tva);
        const cb = (v) => v ? 1 : 0;
        let totalTtc = appliquerTva(total, mentionVal, tvaPct);

        let result;
        for (let tentative = 0; ; tentative++) {
            try {
                result = await db.run(
                    `INSERT INTO document (type, numero, date_doc, client_type, client_nom, nom_client, client_ice, client_adresse,
                                           total_dhs, creator_id, mode_paiement, tisse, noue, hand_tuft, stock,
                                           montant_lettres, etat, mention, tva, qualite, remarque)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
                    type, finalNumero, date_doc, ct,
                    client_nom || '', nom_client || '', client_ice || '', client_adresse || '',
                    totalTtc,
                    req.user ? req.user.id : null,
                    mode_paiement || '',
                    cb(tisse), cb(noue), cb(hand_tuft), cb(stock),
                    montant_lettres || '',
                    ETATS.includes(etat) ? etat : 'brouillon',
                    mentionVal, tvaPct,
                    qualite || '', remarque || ''
                );
                break;
            } catch (e) {
                if (db.isUniqueError(e) && !numeroManuel && tentative < 3) {
                    finalNumero = await genererNumero(type);
                    continue;
                }
                if (db.isUniqueError(e)) {
                    return res.status(400).json({ error: 'Ce numéro existe déjà' });
                }
                throw e;
            }
        }

        const docId = Number(result.lastInsertRowid);
        const insertLigne = async (l) => {
            const longueur = norm(l.longueur);
            const largeur = norm(l.largeur);
            const qte = normInt(l.qte) || 1;
            const surface = surfaceLigne({ longueur, largeur, qte, surface: l.surface });
            const puP = norm(l.pu_particulier);
            const puR = norm(l.pu_revendeur);
            const pu = ct === 'revendeur' ? puR : puP;
            const montant = montantLigne({ longueur, largeur, qte, surface: l.surface, pu });
            await db.run(
                `INSERT INTO document_ligne (doc_id, designation, type_ligne, qte, longueur, largeur, surface,
                                             nb_pieces, unite, pu_particulier, pu_revendeur, montant)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'm2', ?, ?, ?)`,
                docId, l.designation || '', l.type_ligne || '', qte, longueur, largeur, surface,
                puP, puR, montant
            );
        };
        for (const l of rows) await insertLigne(l);

        if (!total && rows.length) {
            const sum = await db.get('SELECT SUM(montant) AS t FROM document_ligne WHERE doc_id = ?', docId);
            totalTtc = appliquerTva(arrondi2(sum.t || 0), mentionVal, tvaPct);
            await db.run('UPDATE document SET total_dhs = ? WHERE id = ?', totalTtc, docId);
        }

        if (!montant_lettres) {
            const mt = nombreEnLettres(totalTtc) + ' DIRHAMS';
            await db.run('UPDATE document SET montant_lettres = ? WHERE id = ?', mt.toUpperCase(), docId);
        }

        res.status(201).json({ id: docId, numero: finalNumero, total_dhs: totalTtc });
    } catch (e) { next(e); }
});

router.put('/:id', requireAdmin, async (req, res, next) => {
    try {
        const id = parseInt(req.params.id, 10);
        const doc = await db.get('SELECT * FROM document WHERE id = ?', id);
        if (!doc) return res.status(404).json({ error: 'Document non trouvé' });

        const { numero, date_doc, client_type, client_nom, nom_client, client_ice, client_adresse,
                lignes, etat, mention, tva, qualite, remarque, montant_lettres, mode_paiement,
                tisse, noue, hand_tuft, stock } = req.body;

        let finalNumero = numero || doc.numero;
        if (finalNumero !== doc.numero) {
            const exists = await db.get('SELECT id FROM document WHERE numero = ? AND id != ?', finalNumero, doc.id);
            if (exists) return res.status(400).json({ error: 'Ce numéro existe déjà' });
        }

        const ct = client_type === 'revendeur' ? 'revendeur' : 'particulier';
        const mentionVal = mention !== undefined ? (mention ? 1 : 0) : doc.mention;
        const tvaPct = tva !== undefined ? norm(tva) : norm(doc.tva);

        let total;
        if (lignes !== undefined && Array.isArray(lignes)) {
            await db.run('DELETE FROM document_ligne WHERE doc_id = ?', doc.id);
            let base = 0;
            for (const l of lignes) {
                const longueur = norm(l.longueur);
                const largeur = norm(l.largeur);
                const qte = normInt(l.qte) || 1;
                const surface = surfaceLigne({ longueur, largeur, qte, surface: l.surface });
                const puP = norm(l.pu_particulier);
                const puR = norm(l.pu_revendeur);
                const pu = ct === 'revendeur' ? puR : puP;
                const montant = montantLigne({ longueur, largeur, qte, surface: l.surface, pu });
                base += montant;
                await db.run(
                    `INSERT INTO document_ligne (doc_id, designation, type_ligne, qte, longueur, largeur, surface,
                                                 nb_pieces, unite, pu_particulier, pu_revendeur, montant)
                     VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'm2', ?, ?, ?)`,
                    doc.id, l.designation || '', l.type_ligne || '', qte, longueur, largeur, surface,
                    puP, puR, montant
                );
            }
            total = appliquerTva(arrondi2(base), mentionVal, tvaPct);
        } else {
            const base = (doc.mention === 1 && norm(doc.tva) > 0) ? arrondi2(doc.total_dhs / (1 + norm(doc.tva) / 100)) : doc.total_dhs;
            total = appliquerTva(base, mentionVal, tvaPct);
        }

        await db.run(
            `UPDATE document SET numero = ?, date_doc = ?, client_type = ?, client_nom = ?, nom_client = ?, client_ice = ?,
             client_adresse = ?, total_dhs = ?, mode_paiement = ?, tisse = ?, noue = ?, hand_tuft = ?, stock = ?,
             montant_lettres = ?, etat = ?, mention = ?, tva = ?,
             qualite = ?, remarque = ? WHERE id = ?`,
            finalNumero, date_doc || doc.date_doc, ct,
            client_nom !== undefined ? client_nom : doc.client_nom,
            nom_client !== undefined ? nom_client : doc.nom_client || '',
            client_ice !== undefined ? client_ice : doc.client_ice,
            client_adresse !== undefined ? client_adresse : doc.client_adresse,
            total,
            mode_paiement !== undefined ? mode_paiement : doc.mode_paiement || '',
            tisse !== undefined ? (tisse ? 1 : 0) : doc.tisse,
            noue !== undefined ? (noue ? 1 : 0) : doc.noue,
            hand_tuft !== undefined ? (hand_tuft ? 1 : 0) : doc.hand_tuft,
            stock !== undefined ? (stock ? 1 : 0) : doc.stock,
            montant_lettres !== undefined ? montant_lettres : doc.montant_lettres,
            ETATS.includes(etat) ? etat : doc.etat,
            mentionVal, tvaPct,
            qualite !== undefined ? qualite : doc.qualite,
            remarque !== undefined ? remarque : doc.remarque,
            doc.id
        );

        if (!montant_lettres || !String(montant_lettres).trim()) {
            const mt = nombreEnLettres(total) + ' DIRHAMS';
            await db.run('UPDATE document SET montant_lettres = ? WHERE id = ?', mt.toUpperCase(), doc.id);
        }

        res.json({ message: 'Document mis à jour', total_dhs: total });
    } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
    try {
        const id = parseInt(req.params.id, 10);
        const doc = await db.get('SELECT * FROM document WHERE id = ?', id);
        if (!doc) return res.status(404).json({ error: 'Document non trouvé' });
        if (req.user && req.user.role !== 'admin' && Number(doc.creator_id) !== Number(req.user.id)) {
            return res.status(404).json({ error: 'Document non trouvé' });
        }
        await db.run('DELETE FROM document WHERE id = ?', doc.id);
        res.json({ message: 'Document supprimé' });
    } catch (e) { next(e); }
});

module.exports = router;