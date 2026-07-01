// ============================================================================
// Utilitários compartilhados: escape HTML, slug, datas em America/Sao_Paulo,
// sanitização básica de HTML vindo do banco/IA.
// ============================================================================

/** Escapa string pra interpolação segura em HTML. */
export function esc(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Slug válido: minúsculas, números e hífens. */
export const SLUG_RE = /^[a-z0-9-]+$/;

/** Gera slug a partir de um título (remove acentos, normaliza). */
export function slugify(str) {
    return String(str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // remove acentos (combining marks)
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 120);
}

/**
 * Partes da data atual em America/Sao_Paulo.
 * Retorna { ymd: 'YYYY-MM-DD', weekday: 0-6 (0=domingo), hour: 0-23 }
 */
export function nowInSaoPaulo(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', hour12: false, weekday: 'short',
    }).formatToParts(date);

    const get = (type) => parts.find((p) => p.type === type)?.value;
    const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

    return {
        ymd: `${get('year')}-${get('month')}-${get('day')}`,
        weekday: weekdayMap[get('weekday')] ?? 0,
        hour: parseInt(get('hour'), 10) % 24,
    };
}

/** Converte timestamptz → 'YYYY-MM-DD' no fuso de São Paulo. */
export function toSaoPauloYMD(isoString) {
    if (!isoString) return null;
    return nowInSaoPaulo(new Date(isoString)).ymd;
}

/**
 * Sanitização defensiva do HTML do artigo (gerado por IA ou editado no admin).
 * Remove <script>/<style>/<iframe>, event handlers inline e URLs javascript:.
 * Não é um sanitizer completo — o conteúdo vem de fontes controladas (IA +
 * admin autenticado), isto é cinto de segurança, não airbag.
 */
export function sanitizeHtml(html) {
    return String(html || '')
        .replace(/<\s*(script|style|iframe|object|embed|form)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
        .replace(/<\s*(script|style|iframe|object|embed|form)[^>]*\/?\s*>/gi, '')
        .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/(href|src)\s*=\s*(["']?)\s*javascript:[^"'\s>]*\2/gi, '$1="#"');
}

/** Conta palavras do texto visível de um HTML. */
export function countWords(html) {
    const text = String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return text ? text.split(' ').length : 0;
}

/** Lê o body JSON de uma request (a Vercel já parseia; fallback manual). */
export async function readJsonBody(req) {
    if (req.body) {
        return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    }
    let raw = '';
    for await (const chunk of req) raw += chunk;
    return raw ? JSON.parse(raw) : {};
}

/** Resposta de erro JSON padronizada. */
export function sendError(res, status, message, detail) {
    res.status(status).json({ error: message, ...(detail ? { detail: String(detail).slice(0, 500) } : {}) });
}
