const API_BASE = '/api';

// ---------- Session / token JWT ----------
function getToken() { try { return localStorage.getItem('token'); } catch (e) { return null; } }
function setToken(t) { try { localStorage.setItem('token', t); } catch (e) {} }
function getUser() { try { return JSON.parse(localStorage.getItem('user')); } catch (e) { return null; } }
function setUser(u) { try { localStorage.setItem('user', JSON.stringify(u)); } catch (e) {} }
function clearSession() {
    try {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('mocary_docs_nouveau');
    } catch (e) {}
}

function decodageJwt(token) {
    try {
        const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const pad = part.length % 4 === 0 ? '' : '='.repeat(4 - (part.length % 4));
        return JSON.parse(atob(part + pad));
    } catch (e) { return null; }
}

function isLoggedIn() {
    const t = getToken();
    if (!t) return false;
    const payload = decodageJwt(t);
    if (!payload || !payload.exp) { clearSession(); return false; }
    if (Date.now() / 1000 > payload.exp) { clearSession(); return false; }
    return true;
}

function logout() { clearSession(); window.location.href = 'index.html'; }

function checkAuth() {
    if (!isLoggedIn()) { window.location.href = 'index.html'; return false; }
    return true;
}

async function apiCall(url, options = {}) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    let res;
    try {
        res = await fetch(`${API_BASE}${url}`, { ...options, headers });
    } catch (e) {
        throw new Error('Serveur injoignable. Vérifiez que le serveur est démarré.');
    }
    if (res.status === 401 && token && !url.startsWith('/auth/')) {
        clearSession();
        window.location.href = 'index.html';
        throw new Error('Session expirée, veuillez vous reconnecter');
    }
    if (!res.ok) {
        let msg = 'Erreur serveur (' + res.status + ')';
        try { const err = await res.json(); msg = err.error || msg; } catch (e) { /* non JSON */ }
        throw new Error(msg);
    }
    const ct = res.headers.get('content-type');
    if (ct && ct.includes('application/json')) return res.json();
    return res;
}

async function downloadFile(url, filename) {
    const token = getToken();
    const headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    let res;
    try {
        res = await fetch(`${API_BASE}${url}`, { headers });
    } catch (e) {
        throw new Error('Serveur injoignable');
    }
    if (res.status === 401 && token) {
        clearSession();
        window.location.href = 'index.html';
        throw new Error('Session expirée, veuillez vous reconnecter');
    }
    if (!res.ok) {
        let msg = 'Export impossible';
        try { msg = (await res.json()).error || msg; } catch (e) { /* ignore */ }
        throw new Error(msg);
    }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function escapeHtml(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function formatDate(d) {
    if (!d) return '-';
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d));
    return m ? `${m[3]}/${m[2]}/${m[1]}` : String(d);
}

function formatMontant(m, devise = 'DHS') {
    const n = Number(m);
    if (!isFinite(n)) return '0,00 ' + devise;
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' ' + devise;
}

function fmt(n) {
    if (n === null || n === undefined || n === '' || isNaN(n)) return '';
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function showNotification(message, type = 'success') {
    let existing = document.getElementById('notification');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.id = 'notification';
    div.className = 'notification ' + type;
    div.textContent = message;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3500);
}

function nombreMots(n) {
    const UNITE = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
        'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
    const DIZAINE = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];
    const trois = (p) => {
        let r = '';
        const h = Math.floor(p / 100), rest = p % 100;
        if (h > 0) { r += (h > 1 ? UNITE[h] + ' ' : '') + 'cent'; if (rest === 0 && h > 1) r += 's'; if (rest > 0) r += ' '; }
        if (rest > 0) {
            if (rest < 20) r += UNITE[rest];
            else {
                const d = Math.floor(rest / 10), u = rest % 10;
                r += DIZAINE[d];
                if (d === 7 || d === 9) r += (u === 1 && d === 7 ? '-et-un' : '-' + UNITE[10 + u]);
                else { if (u === 1 && d !== 8) r += '-et-un'; else if (u > 0) r += '-' + UNITE[u]; if (d === 8 && u === 0) r += 's'; }
            }
        }
        return r;
    };
    let w = '';
    const md = Math.floor(n / 1e9), m = Math.floor((n % 1e9) / 1e6), k = Math.floor((n % 1e6) / 1000), r = n % 1000;
    if (md > 0) w += (md > 1 ? trois(md) + ' ' : '') + 'milliards';
    if (m > 0) { if (w) w += ' '; w += (m > 1 ? trois(m) + ' ' : '') + 'million' + (m > 1 ? 's' : ''); }
    if (k > 0) { if (w) w += ' '; w += (k > 1 ? trois(k) + ' ' : '') + 'mille'; }
    if (r > 0) { if (w) w += ' '; w += trois(r); }
    return w || 'zéro';
}

function montantEnLettres(x) {
    const dh = Math.floor(x);
    const cts = Math.round((x - dh) * 100);
    let s = nombreMots(dh) + ' DIRHAMS';
    if (cts > 0) s += ' ET ' + nombreMots(cts) + ' CENTIMES';
    return s.toUpperCase();
}