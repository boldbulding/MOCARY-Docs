const UNITE = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
    'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const DIZAINE = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];
const CENT = 'cent';
const MILLE = 'mille';
const MILLION = 'million';
const MILLIARD = 'milliard';

function trois(part) {
    let res = '';
    const h = Math.floor(part / 100);
    const reste = part % 100;
    if (h > 0) {
        res += (h > 1 ? UNITE[h] + ' ' : '') + CENT;
        if (reste === 0 && h > 1) res += 's';
        if (reste > 0) res += ' ';
    }
    if (reste > 0) {
        if (reste < 20) {
            res += UNITE[reste];
        } else {
            const d = Math.floor(reste / 10);
            const u = reste % 10;
            res += DIZAINE[d];
            if (d === 7 || d === 9) {
                res += u === 1 && d === 7 ? '-et-un' : '-' + UNITE[10 + u];
            } else {
                if (u === 1 && d !== 8) res += '-et-un';
                else if (u > 0) res += '-' + UNITE[u];
                if (d === 8 && u === 0) res += 's';
            }
        }
    }
    return res;
}

function nombreEnLettres(n) {
    if (typeof n !== 'number' || isNaN(n)) return '';
    const negatif = n < 0;
    n = Math.abs(Math.round(n));
    if (n === 0) return 'zéro';

    let words = '';
    const milliards = Math.floor(n / 1e9);
    const millions = Math.floor((n % 1e9) / 1e6);
    const milliers = Math.floor((n % 1e6) / 1000);
    const reste = n % 1000;

    if (milliards > 0) words += (milliards > 1 ? trois(milliards) + ' ' : '') + MILLIARD + 's';
    if (millions > 0) {
        if (words) words += ' ';
        words += (millions > 1 ? trois(millions) + ' ' : '') + MILLION + 's';
    }
    if (milliers > 0) {
        if (words) words += ' ';
        words += (milliers > 1 ? trois(milliers) + ' ' : '') + MILLE;
    }
    if (reste > 0) {
        if (words) words += ' ';
        words += trois(reste);
    }

    return (negatif ? 'moins ' : '') + words;
}

module.exports = { nombreEnLettres };