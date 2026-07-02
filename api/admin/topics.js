// ============================================================================
// /api/admin/topics — CRUD da fila de pautas (requer x-admin-password)
//   GET    ?status=  — lista (padrão: pending+used, ordenado por prioridade)
//   POST   — cria pauta
//   PATCH  ?id= — edita
//   DELETE ?id= — descarta (status=discarded)
// ============================================================================

import { requireAdmin } from '../_lib/auth.js';
import { sbFetch } from '../_lib/supabase.js';
import { readJsonBody, sendError, SLUG_RE } from '../_lib/util.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = ['pending', 'used', 'discarded'];

function cleanPayload(body, { isCreate }) {
    const out = {};
    if ('topic' in body) {
        out.topic = String(body.topic || '').trim().slice(0, 500);
        if (!out.topic) throw new Error('topic não pode ser vazio');
    }
    if (isCreate && !out.topic) throw new Error('topic é obrigatório');

    if ('target_keyword' in body) out.target_keyword = String(body.target_keyword || '').slice(0, 200) || null;
    if ('category' in body) out.category = String(body.category || '').slice(0, 100) || null;
    if ('category_slug' in body) {
        const cs = String(body.category_slug || '').trim();
        if (cs && !SLUG_RE.test(cs)) throw new Error('category_slug inválido');
        out.category_slug = cs || null;
    }
    if ('product_slug' in body) {
        const ps = String(body.product_slug || '').trim();
        if (ps && !SLUG_RE.test(ps)) throw new Error('product_slug inválido');
        out.product_slug = ps || null;
    }
    if ('priority' in body) {
        const p = parseInt(body.priority, 10);
        if (!Number.isInteger(p) || p < 0 || p > 100) throw new Error('priority deve ser 0-100');
        out.priority = p;
    }
    if ('status' in body) {
        if (!STATUSES.includes(body.status)) throw new Error(`status inválido (${STATUSES.join('|')})`);
        out.status = body.status;
        if (body.status === 'pending') out.used_at = null;
    }
    if ('notes' in body) out.notes = String(body.notes || '').slice(0, 2000) || null;
    return out;
}

export default async function handler(req, res) {
    try {
        if (!requireAdmin(req, res)) return;

        if (req.method === 'GET') {
            const status = String(req.query?.status || '').trim();
            let path = 'blog_topics?order=status.asc,priority.desc,created_at.asc&limit=300';
            if (status) {
                if (!STATUSES.includes(status)) return sendError(res, 400, 'Status inválido');
                path = `blog_topics?status=eq.${status}&order=priority.desc,created_at.asc&limit=300`;
            }
            const rows = await sbFetch(path);
            return res.status(200).json(rows || []);
        }

        if (req.method === 'POST') {
            const body = await readJsonBody(req);
            const payload = cleanPayload(body, { isCreate: true });
            if (!payload.status) payload.status = 'pending';
            const rows = await sbFetch('blog_topics', { method: 'POST', body: payload });
            return res.status(201).json(rows[0]);
        }

        if (req.method === 'PATCH') {
            const id = String(req.query?.id || '');
            if (!UUID_RE.test(id)) return sendError(res, 400, 'id inválido');
            const body = await readJsonBody(req);
            const payload = cleanPayload(body, { isCreate: false });
            if (!Object.keys(payload).length) return sendError(res, 400, 'Nada para atualizar');
            const rows = await sbFetch(`blog_topics?id=eq.${id}`, { method: 'PATCH', body: payload });
            if (!rows || !rows.length) return sendError(res, 404, 'Pauta não encontrada');
            return res.status(200).json(rows[0]);
        }

        if (req.method === 'DELETE') {
            const id = String(req.query?.id || '');
            if (!UUID_RE.test(id)) return sendError(res, 400, 'id inválido');
            // Soft delete: marca como descartada (mantém histórico)
            const rows = await sbFetch(`blog_topics?id=eq.${id}`, {
                method: 'PATCH',
                body: { status: 'discarded' },
            });
            if (!rows || !rows.length) return sendError(res, 404, 'Pauta não encontrada');
            return res.status(200).json(rows[0]);
        }

        return sendError(res, 405, 'Método não permitido');
    } catch (err) {
        console.error('api/admin/topics:', err);
        const isValidation = /obrigatório|inválid|vazio|deve ser/.test(err.message);
        return sendError(res, isValidation ? 400 : 500, err.message);
    }
}
