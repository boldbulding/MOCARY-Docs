let currentType = '';
let reqSeq = 0;

if (!checkAuth()) throw new Error('Non connecté');

const userCourant = getUser();
const estAdmin = !!(userCourant && userCourant.role === 'admin');

const etatLabels = { brouillon: 'Brouillon', emise: 'Émise', validee: 'Validée', annulee: 'Annulée' };
const clientTypeLabels = { particulier: 'Particulier', revendeur: 'Revendeur' };

function charge(type) {
    currentType = type;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.t === type));
    loadDocs();
}

function badge(etat) {
    const cls = etatLabels[etat] ? etat : 'brouillon';
    return `<span class="badge badge-${cls}">${escapeHtml(etatLabels[etat] || etat || '-')}</span>`;
}

function buildQuery() {
    const q = new URLSearchParams();
    if (currentType) q.set('type', currentType);
    const commercial = document.getElementById('filterCommercial').value.trim();
    const search = document.getElementById('search').value.trim();
    const etat = document.getElementById('filterEtat').value;
    if (commercial) q.set('commercial', commercial);
    if (search) q.set('search', search);
    if (etat) q.set('etat', etat);
    return q.toString();
}

async function loadDocs() {
    const mySeq = ++reqSeq;
    const tbody = document.getElementById('docsTable');
    tbody.innerHTML = '<tr><td colspan="9" class="empty-row"><span class="spinner"></span> Chargement…</td></tr>';
    let docs;
    try {
        docs = await apiCall('/documents?' + buildQuery());
    } catch (e) {
        if (mySeq !== reqSeq) return;
        tbody.innerHTML = `<tr><td colspan="9" class="empty-row" style="color:var(--danger)">${escapeHtml(e.message)}</td></tr>`;
        return;
    }
    if (mySeq !== reqSeq) return;
    tbody.innerHTML = '';
    if (!docs || docs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-row">Aucun document. Cliquez sur « Nouveau devis » ou « Nouvelle facture ».</td></tr>';
        return;
    }
    docs.forEach(d => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="badge ${d.type === 'devis' ? 'badge-devis' : 'badge-facture'}">${escapeHtml((d.type || '').toUpperCase())}</span></td>
            <td><strong>${escapeHtml(d.numero)}</strong></td>
            <td>${formatDate(d.date_doc)}</td>
            <td>${escapeHtml(d.nom_client || d.client_nom || '-')}</td>
            <td>${escapeHtml(d.client_ice || '-')}</td>
            <td><span class="badge ${d.client_type === 'revendeur' ? 'badge-rev' : 'badge-part'}">${escapeHtml(clientTypeLabels[d.client_type] || d.client_type || '-')}</span></td>
            <td class="text-right">${formatMontant(d.total_dhs, '')}</td>
            <td>${badge(d.etat)}</td>
            <td class="actions">
                <a class="btn btn-sm btn-primary" href="print.html?id=${Number(d.id)}" title="Imprimer">🖨 Imprimer</a>
                ${estAdmin ? `<a class="btn btn-sm" href="form.html?id=${Number(d.id)}" title="Modifier">✏️ Modifier</a>` : ''}
                <button class="btn btn-sm btn-danger" onclick="supprimer(${Number(d.id)})" title="Supprimer">🗑</button>
            </td>`;
        tbody.appendChild(tr);
    });
}

let exportEnCours = false;
async function exportExcel() {
    if (exportEnCours) return;
    exportEnCours = true;
    const btn = document.getElementById('excelBtn');
    btn.disabled = true;
    try {
        await downloadFile('/documents/excel/list?' + buildQuery(), 'mocary_factures_devis.xlsx');
        showNotification('Export Excel téléchargé');
    } catch (e) {
        showNotification(e.message, 'error');
    } finally {
        exportEnCours = false;
        btn.disabled = false;
    }
}

async function supprimer(id) {
    if (!confirm('Supprimer ce document ?')) return;
    try {
        await apiCall('/documents/' + id, { method: 'DELETE' });
        showNotification('Document supprimé');
        loadDocs();
    } catch (e) { showNotification(e.message, 'error'); }
}

document.getElementById('search').addEventListener('keyup', e => { if (e.key === 'Enter') loadDocs(); });
document.getElementById('filterCommercial').addEventListener('keyup', e => { if (e.key === 'Enter') loadDocs(); });
document.getElementById('filterEtat').addEventListener('change', loadDocs);

loadDocs();