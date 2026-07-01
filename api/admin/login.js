// ============================================================================
// POST /api/admin/login — valida a senha do painel {password} → {ok:true}|401
// ============================================================================

import { checkPassword } from '../_lib/auth.js';
import { readJsonBody, sendError } from '../_lib/util.js';

export default async function handler(req, res) {
    try {
        if (req.method !== 'POST') {
            return sendError(res, 405, 'Método não permitido');
        }
        const body = await readJsonBody(req).catch(() => ({}));
        if (checkPassword(body.password)) {
            return res.status(200).json({ ok: true });
        }
        return res.status(401).json({ ok: false, error: 'Senha incorreta' });
    } catch (err) {
        console.error('api/admin/login:', err);
        return sendError(res, 500, 'Erro no login', err.message);
    }
}
