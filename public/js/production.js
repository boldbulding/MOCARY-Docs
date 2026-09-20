let reqSeq = 0;

if (!checkAuth()) throw new Error('Non connecté');

const userCourant = getUser();
if (!userCourant || (userCourant.role !== 'production' && userCourant.role !== 'admin')) {
    window.location.href = 'documents.html';
    throw new Error('Accès réservé au service production');
}

const etatLabels = { brouillon: 'Brouillon', emise: 'Émise', validee: 'Validée', annulee: 'Annulée' };

function badge(etat) {
    const cls = etatLabels[etat] ? etat : 'brouillon';
    return `<span class="badge badge-${cls}">${escapeHtml(etatLabels[etat] || etat || '-')}</span>`;
}

function badgeTapis(v) {
    return v ? '<span class="badge badge-validee">OUI</span>' : '<span class="badge badge-brouillon">NON</span>';
}

function heureValidee(le) {
    if (!le) return '';
    const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(String(le));
    return m ? m[2] : '';
}

function buildQuery() {
    const q = new URLSearchParams();
    const search = document.getElementById('search').value.trim();
    const etat = document.getElementById('filterEtat').value;
    const tapis = document.getElementById('filterTapis').value;
    if (search) q.set('search', search);
    if (etat) q.set('etat', etat);
    if (tapis !== '') q.set('tapis_pret', tapis);
    return q.toString();
}

async function loadDocs() {
    const mySeq = ++reqSeq;
    const tbody = document.getElementById('docsTable');
    tbody.innerHTML = '<tr><td colspan="10" class="empty-row"><span class="spinner"></span> Chargement…</td></tr>';
    let docs;
    try {
        docs = await apiCall('/documents?' + buildQuery());
    } catch (e) {
        if (mySeq !== reqSeq) return;
        tbody.innerHTML = `<tr><td colspan="10" class="empty-row" style="color:var(--danger)">${escapeHtml(e.message)}</td></tr>`;
        return;
    }
    if (mySeq !== reqSeq) return;
    tbody.innerHTML = '';
    if (!docs || docs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="empty-row">Aucune commande. Les commandes créées par l\'administrateur apparaîtront ici automatiquement.</td></tr>';
        return;
    }
    docs.forEach(d => {
        const verrouille = ['validee', 'annulee'].includes(d.etat);
        const select = verrouille
            ? badgeTapis(d.tapis_pret)
            : `<select class="tapis-sel" onchange="setTapis(${Number(d.id)}, this.value)" title="Tapis prêt : OUI / NON">
                  <option value="0" ${d.tapis_pret ? '' : 'selected'}>NON</option>
                  <option value="1" ${d.tapis_pret ? 'selected' : ''}>OUI</option>
               </select>`;
        const validation = d.valide_le
            ? `<span class="val-info">le ${formatDate(d.valide_le)} à ${heureValidee(d.valide_le)}${d.valide_par ? ' par ' + escapeHtml(d.valide_par) : ''}</span>`
            : '<span class="muted">-</span>';
        let bouton;
        if (d.etat === 'validee') bouton = '<span class="muted">✔ Validée</span>';
        else if (d.etat === 'annulee') bouton = '<span class="muted">Annulée</span>';
        else bouton = `<button class="btn btn-sm btn-primary" onclick="valider(${Number(d.id)})" ${d.tapis_pret ? '' : 'disabled'} title="OUI requis pour valider">✔ Valider</button>`;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="badge ${d.type === 'devis' ? 'badge-devis' : 'badge-facture'}">${escapeHtml((d.type || '').toUpperCase())}</span></td>
            <td><strong>${escapeHtml(d.numero)}</strong></td>
            <td>${formatDate(d.date_doc)}</td>
            <td>${escapeHtml(d.nom_client || d.client_nom || '-')}</td>
            <td>${escapeHtml(d.client_ice || '-')}</td>
            <td class="text-right">${formatMontant(d.total_dhs, '')}</td>
            <td>${badge(d.etat)}</td>
            <td>${select}</td>
            <td>${validation}</td>
            <td class="actions">
                <a class="btn btn-sm" href="print.html?id=${Number(d.id)}" title="Consulter la commande">👁 Consulter</a>
                ${bouton}
            </td>`;
        tbody.appendChild(tr);
    });
}

async function setTapis(id, val) {
    try {
        await apiCall('/documents/' + id + '/tapis-pret', {
            method: 'PATCH',
            body: JSON.stringify({ tapis_pret: val === '1' ? 1 : 0 })
        });
        showNotification('Tapis prêt : ' + (val === '1' ? 'OUI' : 'NON'));
        loadDocs();
    } catch (e) {
        showNotification(e.message, 'error');
        loadDocs();
    }
}

async function valider(id) {
    if (!confirm('Valider cette commande ? Le tapis est déclaré prêt et la commande passera à l\'état VALIDÉE.')) return;
    try {
        const updated = await apiCall('/documents/' + id + '/valider-production', { method: 'POST' });
        showNotification('Commande ' + updated.numero + ' validée');
        loadDocs();
    } catch (e) {
        showNotification(e.message, 'error');
    }
}

document.getElementById('search').addEventListener('keyup', e => { if (e.key === 'Enter') loadDocs(); });
document.getElementById('filterEtat').addEventListener('change', loadDocs);
document.getElementById('filterTapis').addEventListener('change', loadDocs);

loadDocs();