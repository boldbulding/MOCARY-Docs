const params = new URLSearchParams(window.location.search);
const editId = /^\d+$/.test(params.get('id') || '') ? params.get('id') : null;
const docTypeParam = ['devis', 'facture'].includes(params.get('type')) ? params.get('type') : null;

if (!checkAuth()) throw new Error('Non connecté');

let activeType = 'particulier';
let clientsListe = [];

function currentClientType() {
    return document.getElementById('ctRevendeur').checked ? 'revendeur' : 'particulier';
}

function setClientType(type) {
    activeType = type;
    document.getElementById('ctParticulier').checked = type !== 'revendeur';
    document.getElementById('ctRevendeur').checked = type === 'revendeur';
    const hint = document.getElementById('puHint');
    if (hint) hint.textContent = type === 'revendeur' ? 'Revendeur' : 'Particulier';
    hint.classList.toggle('pu-active-badge', type === 'revendeur');
}

document.getElementById('ctParticulier').addEventListener('change', (e) => {
    const checked = e.target.checked;
    document.getElementById('ctRevendeur').checked = !checked;
    if (checked) switchType('particulier');
});
document.getElementById('ctRevendeur').addEventListener('change', (e) => {
    const checked = e.target.checked;
    document.getElementById('ctParticulier').checked = !checked;
    if (checked) switchType('revendeur');
});

function switchType(type) {
    if (type === activeType) { setClientType(type); return; }
    const old = activeType;
    document.querySelectorAll('#linesBody tr').forEach(tr => {
        const puInp = tr.querySelector('.pu-inp');
        if (puInp) tr.puValues[old] = parseFloat(String(puInp.value).replace(',', '.')) || 0;
    });
    activeType = type;
    setClientType(type);
    document.querySelectorAll('#linesBody tr').forEach(tr => {
        const puInp = tr.querySelector('.pu-inp');
        if (puInp) { puInp.value = (tr.puValues[type] || ''); recalc(tr); }
    });
}

function newLine(data) {
    data = data || {};
    const tr = document.createElement('tr');
    tr.puValues = {
        particulier: norm(data.pu_particulier),
        revendeur: norm(data.pu_revendeur)
    };

    const mkInput = (cfg, value) => {
        const inp = document.createElement('input');
        inp.type = cfg.type || 'text';
        inp.className = (cfg.small ? 'small ' : '') + (cfg.mt ? 'mt' : '');
        if (cfg.step) inp.step = cfg.step; else inp.step = 'any';
        inp.placeholder = cfg.ph || '';
        if (value !== undefined && value !== null) inp.value = value;
        return inp;
    };

    const fields = [
        { key: 'designation', cls: '' },
        { key: 'qte', cls: 'small', type: 'number', ph: 'QTE' },
        { key: 'longueur', cls: 'small', type: 'number', step: '0.01', ph: 'LONG' },
        { key: 'largeur', cls: 'small', type: 'number', step: '0.01', ph: 'LARG' },
        { key: 'surface', cls: 'small', type: 'number', step: '0.01', ph: 'SURF' },
        { key: 'type_ligne', cls: 'small', type: 'text', maxlength: 1, ph: 'S/M/L' },
        { key: 'pu', cls: 'small pu-inp', type: 'number', step: '0.01', ph: 'P.U.' },
        { key: 'montant', cls: 'small mt', type: 'number', step: '0.01', ph: 'Montant' }
    ];

    let idx = 0;
    fields.forEach((cfg) => {
        const td = document.createElement('td');
        let el;
        if (cfg.select) {
            el = document.createElement('select');
            el.className = 'small';
            if (cfg.key === 'type_ligne') el.title = 'Choisir : S, M ou L';
            cfg.select.forEach(([v, l]) => {
                const o = document.createElement('option');
                o.value = v; o.textContent = l;
                el.appendChild(o);
            });
            let val = data[cfg.key];
            if (cfg.key === 'pu') val = tr.puValues[activeType] || '';
            el.value = val !== undefined && val !== null ? val : '';
        } else {
            el = mkInput(cfg, data[cfg.key]);
            if (cfg.key === 'pu') {
                el.value = tr.puValues[activeType] || '';
                el.addEventListener('input', () => { tr.puValues[activeType] = norm(el.value); recalc(tr); });
            } else if (cfg.key === 'longueur' || cfg.key === 'largeur') {
                el.addEventListener('input', () => recalc(tr));
            } else if (cfg.key === 'surface') {
                el.addEventListener('input', () => { el.dataset.manual = '1'; recalc(tr); });
            } else if (cfg.key === 'qte') {
                el.addEventListener('input', () => recalc(tr));
            } else if (cfg.key === 'montant') {
                el.addEventListener('input', () => { el.dataset.manual = '1'; recalc(tr); });
            }
        }
        if (cfg.maxlength) el.maxLength = cfg.maxlength;
        if (cfg.key === 'type_ligne') {
            el.inputMode = 'text';
            el.title = 'Taper : S, M ou L';
        }
        if (cfg.key === 'type_ligne') el.addEventListener('input', () => { el.value = el.value.toUpperCase(); recalc(tr); });
        td.appendChild(el);
        tr.appendChild(td);
        idx++;
    });

    const tdBtn = document.createElement('td');
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'btn-del'; btn.innerHTML = '✕';
    btn.onclick = () => { tr.remove(); recalcAll(); };
    tdBtn.appendChild(btn);
    tr.appendChild(tdBtn);

    recalc(tr);
    return tr;
}

function norm(s) {
    const v = parseFloat(String(s ?? '').replace(',', '.').replace(/\s/g, ''));
    return isFinite(v) ? v : 0;
}

function getInputs(tr) {
    const cells = tr.cells;
    return {
        designation: cells[0] ? cells[0].querySelector('input').value : '',
        qte: cells[1] ? norm(cells[1].querySelector('input').value) : 0,
        longueur: cells[2] ? norm(cells[2].querySelector('input').value) : 0,
        largeur: cells[3] ? norm(cells[3].querySelector('input').value) : 0,
        surfaceInp: cells[4] ? cells[4].querySelector('input') : null,
        surface: cells[4] ? norm(cells[4].querySelector('input').value) : 0,
        type_ligne: cells[5] ? cells[5].querySelector('input').value : '',
        pu: cells[6] ? cells[6].querySelector('.pu-inp') : null,
        montant: cells[7] ? cells[7].querySelector('input') : null
    };
}

function recalc(tr) {
    const f = getInputs(tr);
    const qte = f.qte || 1;
    const surfAuto = (f.longueur > 0 && f.largeur > 0)
        ? Math.round(qte * f.longueur * f.largeur * 100) / 100
        : null;
    if (surfAuto !== null) {
        f.surfaceInp.value = surfAuto;
        f.surfaceInp.dataset.manual = '';
    } else if (!f.surfaceInp.dataset.manual) {
        f.surfaceInp.value = '';
    }
    const surface = surfAuto !== null ? surfAuto : f.surface;
    const pu = norm(tr.puValues[activeType]);
    const computed = (surface > 0 && pu > 0) ? Math.round(surface * pu * 100) / 100 : 0;
    if (!f.montant.dataset.manual) {
        f.montant.value = computed ? computed : '';
    }
    recalcAll();
}

function recalcAll() {
    let total = 0;
    document.querySelectorAll('#linesBody tr').forEach(tr => {
        const mInp = getInputs(tr).montant;
        total += norm(mInp.value);
    });
    total = Math.round(total * 100) / 100;
    const tvaPct = norm(document.getElementById('tva').value);
    const mentionOn = document.getElementById('mention').value === '1';
    const tvaAppliquee = mentionOn && tvaPct > 0;
    const tvaMontant = tvaAppliquee ? Math.round(total * tvaPct) / 100 : 0;
    const aff = total + tvaMontant;
    document.getElementById('totalHtRow').style.display = tvaAppliquee ? '' : 'none';
    document.getElementById('totalTvaRow').style.display = tvaAppliquee ? '' : 'none';
    document.getElementById('totalHtDisplay').textContent = formatMontant(total);
    document.getElementById('totalTvaDisplay').textContent = formatMontant(tvaMontant) + ' (' + tvaPct + ' %)';
    document.getElementById('totalDisplay').textContent = formatMontant(aff);
    const lett = document.getElementById('montant_lettres');
    if (!lett.dataset.manual) {
        lett.value = aff > 0 ? montantEnLettres(aff) : '';
    }
}

function addLine(data) {
    const tr = newLine(data || {});
    document.getElementById('linesBody').appendChild(tr);
}

async function loadClients() {
    const sel = document.getElementById('client_id');
    try {
        clientsListe = await apiCall('/clients');
    } catch (e) {
        showNotification('Clients non chargés : ' + e.message, 'error');
        clientsListe = [];
    }
    sel.innerHTML = '<option value="">— Choisir —</option>' +
        clientsListe.map(c => `<option value="${Number(c.id)}">${escapeHtml(c.nom)} ${c.type_client === 'revendeur' ? '(Revendeur)' : '(Particulier)'}</option>`).join('');
}

document.getElementById('client_id').addEventListener('change', () => {
    const sel = document.getElementById('client_id');
    const c = clientsListe.find(x => String(x.id) === String(sel.value));
    if (c) {
        document.getElementById('client_nom').value = c.nom || '';
        document.getElementById('client_ice').value = c.ice || '';
        document.getElementById('client_adresse').value = c.adresse || '';
        setClientType(c.type_client || 'particulier');
        switchType(c.type_client || 'particulier');
    }
});

async function saveClientCourant() {
    const nom = document.getElementById('client_nom').value.trim();
    if (!nom) { showNotification('Saisissez un nom de client d\'abord', 'error'); return; }
    try {
        await apiCall('/clients', {
            method: 'POST',
            body: JSON.stringify({
                nom,
                type_client: activeType,
                ice: document.getElementById('client_ice').value,
                adresse: document.getElementById('client_adresse').value
            })
        });
        showNotification('Client ajouté au carnet');
        await loadClients();
    } catch (e) { showNotification(e.message, 'error'); }
}

function collectData() {
    const typeVal = document.querySelector('input[name="type"]:checked').value;
    const lignes = [];
    document.querySelectorAll('#linesBody tr').forEach(tr => {
        const f = getInputs(tr);
        if (!f.designation && !f.montant.value && !f.longueur && !f.largeur && !tr.puValues.particulier && !tr.puValues.revendeur && !f.type_ligne) return;
        lignes.push({
            designation: f.designation,
            type_ligne: f.type_ligne,
            qte: Math.round(f.qte) || 1,
            longueur: f.longueur,
            largeur: f.largeur,
            surface: f.surfaceInp.value ? norm(f.surfaceInp.value) : 0,
            pu_particulier: tr.puValues.particulier,
            pu_revendeur: tr.puValues.revendeur
        });
    });
    return {
        type: typeVal,
        numero: (function () {
            const n = document.getElementById('numero').value.trim();
            if (!n || /^(FAC-|DEV-|FAC|DEV)$/.test(n)) return '';
            return n;
        })(),
        date_doc: document.getElementById('date_doc').value,
        client_type: activeType,
        client_id: document.getElementById('client_id').value || null,
        client_nom: document.getElementById('client_nom').value,
        client_ice: document.getElementById('client_ice').value,
        client_adresse: document.getElementById('client_adresse').value,
        etat: document.getElementById('etat').value,
        mention: document.getElementById('mention').value === '1',
        tva: norm(document.getElementById('tva').value),
        qualite: document.getElementById('qualite').value,
        remarque: document.getElementById('remarque').value,
        montant_lettres: document.getElementById('montant_lettres').value,
        lignes
    };
}

let saveEnCours = false;
async function save() {
    if (saveEnCours) return null;
    const data = collectData();
    if (!data.date_doc) { showNotification('La date est requise', 'error'); return null; }
    if (data.lignes.length === 0) { showNotification('Ajoutez au moins une ligne', 'error'); return null; }
    if (!data.client_nom) { showNotification('Indiquez le nom du client', 'error'); return null; }
    saveEnCours = true;
    document.getElementById('saveBtn').disabled = true;
    document.getElementById('printBtn').disabled = true;
    try {
        if (editId) {
            await apiCall('/documents/' + editId, { method: 'PUT', body: JSON.stringify(data) });
            return { id: editId };
        }
        return await apiCall('/documents', { method: 'POST', body: JSON.stringify(data) });
    } catch (err) {
        showNotification(err.message, 'error');
        return null;
    } finally {
        saveEnCours = false;
        document.getElementById('saveBtn').disabled = false;
        document.getElementById('printBtn').disabled = false;
    }
}

/* Brouillon local */
const DRAFT_KEY = 'mocary_docs_' + (editId ? 'doc_' + editId : 'nouveau');
let timerDraft = null;
function planifierDraft() { clearTimeout(timerDraft); timerDraft = setTimeout(sauvegardeDraft, 700); }
function sauvegardeDraft() {
    const d = {
        type: document.querySelector('input[name="type"]:checked').value,
        client_type: activeType,
        numero: document.getElementById('numero').value,
        date_doc: document.getElementById('date_doc').value,
        client_id: document.getElementById('client_id').value,
        client_nom: document.getElementById('client_nom').value,
        client_ice: document.getElementById('client_ice').value,
        client_adresse: document.getElementById('client_adresse').value,
        etat: document.getElementById('etat').value,
        mention: document.getElementById('mention').value,
        tva: document.getElementById('tva').value,
        qualite: document.getElementById('qualite').value,
        remarque: document.getElementById('remarque').value,
        montant_lettres: document.getElementById('montant_lettres').value,
        lignes: Array.from(document.querySelectorAll('#linesBody tr')).map(tr => {
            const f = getInputs(tr);
            return {
                designation: f.designation, qte: f.qte, longueur: f.longueur, largeur: f.largeur,
                surface: f.surfaceInp.value || '', type_ligne: f.type_ligne, montant: f.montant.value,
                pu_particulier: tr.puValues.particulier, pu_revendeur: tr.puValues.revendeur
            };
        })
    };
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); document.getElementById('draftStatus').classList.add('active'); document.getElementById('draftStatus').textContent = 'Brouillon auto-enregistré'; } catch (e) {}
}
function lireDraft() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch (e) { return null; } }
function viderDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} }

async function majNumeroAuto() {
    const t = document.querySelector('input[name="type"]:checked');
    if (!t) return;
    try {
        const r = await apiCall('/documents/next?type=' + t.value);
        const numInp = document.getElementById('numero');
        if (!numInp.value || /^FAC-|^DEV-/.test(numInp.value)) numInp.value = r.numero;
    } catch (e) { /* silencieux */ }
}

(async () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('date_doc').value = now.toISOString().slice(0, 10);
    await loadClients();
    setClientType('particulier');

    document.getElementById('montant_lettres').addEventListener('input', (e) => { e.target.dataset.manual = '1'; });

    let brouillon = lireDraft();
    if (brouillon && editId && !confirm('Un brouillon non enregistré existe pour ce document. Le restaurer ?')) {
        viderDraft(); brouillon = null;
    }

    if (editId) {
        let doc;
        try { doc = await apiCall('/documents/' + editId); }
        catch (e) {
            showNotification(e.message, 'error');
            setTimeout(() => window.location.href = 'documents.html', 1200);
            return;
        }
        document.getElementById('pageTitle').textContent = 'Modifier ' + (doc.type === 'devis' ? 'le devis' : 'la facture');
        document.querySelector(`input[name="type"][value="${doc.type}"]`).checked = true;
        document.getElementById('numero').value = doc.numero;
        if (doc.date_doc) document.getElementById('date_doc').value = doc.date_doc;
        document.getElementById('etat').value = doc.etat;
        document.getElementById('client_id').value = doc.client_id || '';
        document.getElementById('client_nom').value = doc.client_nom || '';
        document.getElementById('client_ice').value = doc.client_ice || '';
        document.getElementById('client_adresse').value = doc.client_adresse || '';
        document.getElementById('mention').value = doc.mention ? '1' : '0';
        document.getElementById('tva').value = doc.tva || '0';
        document.getElementById('qualite').value = doc.qualite || '';
        document.getElementById('remarque').value = doc.remarque || '';
        setClientType(doc.client_type || 'particulier');
        activeType = doc.client_type || 'particulier';

        if (brouillon) {
            restaurerDraft(brouillon);
        } else {
            doc.lignes.forEach(l => addLine(l));
            document.getElementById('montant_lettres').value = doc.montant_lettres || '';
            recalcAll();
        }
        window.scrollTo(0, 0);
    } else {
        document.getElementById('numero').value = '';
        if (docTypeParam) document.querySelector(`input[name="type"][value="${docTypeParam}"]`).checked = true;
        document.querySelectorAll('input[name="type"]').forEach(r => r.addEventListener('change', majNumeroAuto));
        if (brouillon) {
            restaurerDraft(brouillon);
        } else {
            addLine();
            recalcAll();
        }
        await majNumeroAuto();
    }

    document.getElementById('docForm').addEventListener('input', planifierDraft);
    document.getElementById('docForm').addEventListener('change', planifierDraft);
    document.getElementById('tva').addEventListener('input', recalcAll);
    document.getElementById('mention').addEventListener('change', recalcAll);
})().catch(e => showNotification('Erreur d\'initialisation : ' + e.message, 'error'));

function restaurerDraft(b) {
    document.querySelector(`input[name="type"][value="${b.type || 'facture'}"]`).checked = true;
    setClientType(b.client_type || 'particulier');
    activeType = b.client_type || 'particulier';
    document.getElementById('numero').value = b.numero || '';
    if (b.date_doc) document.getElementById('date_doc').value = b.date_doc;
    document.getElementById('client_id').value = b.client_id || '';
    document.getElementById('client_nom').value = b.client_nom || '';
    document.getElementById('client_ice').value = b.client_ice || '';
    document.getElementById('client_adresse').value = b.client_adresse || '';
    document.getElementById('etat').value = b.etat || 'brouillon';
    document.getElementById('mention').value = b.mention || '1';
    document.getElementById('tva').value = b.tva || '0';
    document.getElementById('qualite').value = b.qualite || '';
    document.getElementById('remarque').value = b.remarque || '';
    (b.lignes || []).forEach(row => {
        const tr = newLine({
            designation: row.designation, qte: row.qte, longueur: row.longueur, largeur: row.largeur,
            surface: row.surface, type_ligne: row.type_ligne,
            pu_particulier: row.pu_particulier, pu_revendeur: row.pu_revendeur
        });
        const f = getInputs(tr);
        if (f.montant) { f.montant.value = row.montant || ''; f.montant.dataset.manual = '1'; }
        document.getElementById('linesBody').appendChild(tr);
        recalc(tr);
    });
    if (b.montant_lettres) {
        document.getElementById('montant_lettres').value = b.montant_lettres;
        document.getElementById('montant_lettres').dataset.manual = '1';
    }
    recalcAll();
    document.getElementById('draftStatus').textContent = 'Brouillon restauré';
    document.getElementById('draftStatus').classList.add('active');
}

document.getElementById('docForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const saved = await save();
    if (saved) { viderDraft(); showNotification('Document enregistré'); setTimeout(() => window.location.href = 'documents.html', 600); }
});

document.getElementById('printBtn').addEventListener('click', async () => {
    const saved = await save();
    if (saved) {
        viderDraft();
        window.location.href = 'print.html?id=' + saved.id;
    }
});