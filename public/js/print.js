const params = new URLSearchParams(window.location.search);
const id = params.get('id');
if (!id) { window.location.href = isLoggedIn() ? 'documents.html' : 'index.html'; throw new Error('no id'); }
if (!checkAuth()) throw new Error('Non connecté');

document.getElementById('editLink').href = 'form.html?id=' + Number(id);

async function charger() {
    const doc = await apiCall('/documents/' + id);
    document.getElementById('titre').textContent = doc.type === 'devis' ? 'DEVIS' : 'FACTURE';
    document.getElementById('clientNom').textContent = doc.client_nom || '-';
    document.getElementById('clientIce').textContent = doc.client_ice || '-';
    if (!doc.client_ice) document.getElementById('clientIceRow').style.display = 'none';
    if (doc.client_adresse) {
        document.getElementById('clientAdresse').textContent = doc.client_adresse;
        document.getElementById('clientAdresseRow').style.display = '';
    }
    document.getElementById('numero').textContent = doc.numero;
    document.getElementById('dateDoc').textContent = formatDate(doc.date_doc);
    document.title = (doc.type === 'devis' ? 'Devis' : 'Facture') + ' ' + doc.numero + ' - MOCARY SA';

    // Case à cocher particulier / revendeur
    const cbPart = document.getElementById('cbPart');
    const cbRev = document.getElementById('cbRev');
    cbPart.textContent = doc.client_type === 'particulier' ? '✓' : ' ';
    cbRev.textContent = doc.client_type === 'revendeur' ? '✓' : ' ';

    const body = document.getElementById('lignesBody');
    body.innerHTML = '';
    const lignes = doc.lignes || [];
    lignes.forEach(l => {
        const tr = document.createElement('tr');
        const pu = doc.client_type === 'revendeur' ? Number(l.pu_revendeur) : Number(l.pu_particulier);
        const cells = [
            l.designation || '',
            l.type_ligne || '',
            fmt(l.qte),
            fmt(l.longueur),
            fmt(l.largeur),
            fmt(l.surface),
            (isFinite(pu) && pu > 0) ? fmt(pu) + '<small>/ m²</small>' : '',
            fmt(l.montant)
        ];
        cells.forEach((c, i) => {
            const td = document.createElement('td');
            if (i === 6) td.innerHTML = c;
            else td.textContent = c;
            if (c === l.designation) td.style.textAlign = 'left';
        });
        body.appendChild(tr);
    });

    const ttc = Number(doc.total_dhs) || 0;
    const tvaVal = Number(doc.tva) || 0;
    const tvaAppliquee = Number(doc.mention) === 1 && tvaVal > 0;
    const tvaMontant = tvaAppliquee ? ttc - ttc / (1 + tvaVal / 100) : 0;
    const ht = ttc - tvaMontant;
    document.getElementById('totalDhs').textContent = fmt(ht) + ' DHS';
    if (tvaAppliquee) {
        document.getElementById('totalGeneral').textContent = fmt(ttc) + ' DHS';
        document.getElementById('tvaRow').style.display = '';
        document.getElementById('tvaLabel').textContent = 'TVA (' + tvaVal + ' %)';
        document.getElementById('tvaDhs').textContent = fmt(tvaMontant) + ' DHS';
    } else {
        document.getElementById('totalGeneral').textContent = fmt(ht) + ' DHS';
        document.getElementById('tvaRow').style.display = 'none';
    }

    const mt = document.getElementById('sommeLettres');
    const typeMot = doc.type === 'devis' ? 'présent devis' : 'présente facture';
    const lettres = (doc.montant_lettres || nombreMots(Math.round(ttc)) + ' DIRHAMS').toUpperCase();
    mt.textContent = 'Arrêtée ' + typeMot + ' à la somme de : ' + lettres;

    if (doc.type === 'facture') {
        document.getElementById('mentionTva').textContent = tvaAppliquee
            ? 'TVA ' + tvaVal + ' % incluse dans le total'
            : (doc.mention ? 'Vente en exonération de la TVA selon Article 91 du CGI' : '');
        document.getElementById('mentionTva').style.display = doc.mention ? 'block' : 'none';
        document.getElementById('mentionQualite').textContent = doc.qualite ||
            'Tapis de fabrication artisanale d\'origine locale';
        document.getElementById('mentionLaine').style.display = 'none';
        document.getElementById('mentionLivraison').textContent = 'DEPART USINE';
        document.getElementById('mentionImportant').textContent =
            'IMPORTANT : Seul l\'entretien à sec est recommandé. La Société Mocary dégage toute responsabilité en cas d\'utilisation d\'un autre procédé.';
        document.getElementById('condPaiement').innerHTML = '<strong>Conditions de paiement :</strong> 60 % à la commande / 40 % à la livraison';
        document.getElementById('condValidite').innerHTML = '';
        document.getElementById('condValidite').style.display = 'none';
    } else {
        document.getElementById('condValidite').style.display = '';
        document.getElementById('mentionTva').textContent = tvaAppliquee
            ? 'TVA ' + tvaVal + ' % incluse dans le total'
            : 'Vente en exonération de la TVA selon article 91 du CGI';
        document.getElementById('mentionTva').style.display = 'block';
        document.getElementById('mentionQualite').textContent = doc.qualite ||
            'Tapis d\'origine Artisanale de production locale';
        document.getElementById('mentionLaine').textContent = 'PURE LAINE VIERGE TRAITEE ANTIMITES CERTIFIEE PAR WOOLMARK';
        document.getElementById('mentionLaine').style.display = 'block';
        document.getElementById('mentionLivraison').textContent = 'Livraison : * Départ usine';
        document.getElementById('mentionImportant').textContent = '';
        document.getElementById('condValidite').innerHTML = '<strong>Devis valable 1 MOIS</strong>';
    }
}

function fmt(n) {
    if (n === null || n === undefined || isNaN(n)) return '';
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

charger().catch(err => { showNotification(err.message || 'Erreur', 'error'); });