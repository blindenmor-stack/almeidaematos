// ============================================================================
// Auth do admin — senha única via header `x-admin-password`
// Comparação timing-safe pra não vazar informação por tempo de resposta.
// ============================================================================

import { timingSafeEqual, createHash } from 'node:crypto';

/** Compara duas strings em tempo constante (via hash → buffers de tamanho igual). */
function safeEqual(a, b) {
    const ha = createHash('sha256').update(String(a)).digest();
    const hb = createHash('sha256').update(String(b)).digest();
    return timingSafeEqual(ha, hb);
}

/**
 * Valida a senha do admin. Se inválida, responde 401 e retorna false —
 * o handler deve dar `return` imediatamente.
 * Uso: `if (!requireAdmin(req, res)) return;`
 */
export function requireAdmin(req, res) {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) {
        res.status(500).json({ error: 'ADMIN_PASSWORD não configurada no servidor' });
        return false;
    }
    const given = req.headers['x-admin-password'];
    if (!given || !safeEqual(given, expected)) {
        res.status(401).json({ error: 'Não autorizado' });
        return false;
    }
    return true;
}

/** Valida se a senha bate (sem responder) — usado pelo /api/admin/login. */
export function checkPassword(password) {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected || !password) return false;
    return safeEqual(password, expected);
}
