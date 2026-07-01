// ============================================================================
// /api/admin/settings — GET/PATCH das configurações (linha editorial, cadência)
// Singleton (id=1). Requer x-admin-password.
// ============================================================================

import { requireAdmin } from '../_lib/auth.js';
import { sbFetch, getSettings } from '../_lib/supabase.js';
import { readJsonBody, sendError } from '../_lib/util.js';

const ALLOWED_MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'];

export default async function handler(req, res) {
    try {
        if (!requireAdmin(req, res)) return;

        if (req.method === 'GET') {
            const settings = await getSettings();
            return res.status(200).json(settings);
        }

        if (req.method === 'PATCH') {
            const body = await readJsonBody(req);
            const payload = {};

            if ('enabled' in body) payload.enabled = Boolean(body.enabled);
            if ('auto_publish' in body) payload.auto_publish = Boolean(body.auto_publish);

            if ('posts_per_week' in body) {
                const n = parseInt(body.posts_per_week, 10);
                if (!Number.isInteger(n) || n < 1 || n > 7) return sendError(res, 400, 'posts_per_week deve ser 1-7');
                payload.posts_per_week = n;
            }
            if ('publish_days' in body) {
                if (!Array.isArray(body.publish_days)) return sendError(res, 400, 'publish_days deve ser array');
                const days = [...new Set(body.publish_days.map((d) => parseInt(d, 10)))]
                    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
                    .sort();
                if (!days.length) return sendError(res, 400, 'Selecione ao menos 1 dia de publicação');
                payload.publish_days = days;
            }
            if ('publish_hour' in body) {
                const h = parseInt(body.publish_hour, 10);
                if (!Number.isInteger(h) || h < 0 || h > 23) return sendError(res, 400, 'publish_hour deve ser 0-23');
                payload.publish_hour = h;
            }
            if ('editorial_line' in body) payload.editorial_line = String(body.editorial_line || '').slice(0, 5000);
            if ('tone' in body) payload.tone = String(body.tone || '').slice(0, 2000);
            if ('extra_instructions' in body) payload.extra_instructions = String(body.extra_instructions || '').slice(0, 5000);
            if ('model' in body) {
                if (!ALLOWED_MODELS.includes(body.model)) {
                    return sendError(res, 400, `Modelo inválido (${ALLOWED_MODELS.join(', ')})`);
                }
                payload.model = body.model;
            }

            if (!Object.keys(payload).length) return sendError(res, 400, 'Nada para atualizar');

            // Upsert: garante o singleton mesmo se o seed não rodou
            const rows = await sbFetch('blog_settings?id=eq.1', { method: 'PATCH', body: payload });
            if (rows && rows.length) return res.status(200).json(rows[0]);

            const created = await sbFetch('blog_settings', {
                method: 'POST',
                body: { id: 1, ...payload },
            });
            return res.status(200).json(created[0]);
        }

        return sendError(res, 405, 'Método não permitido');
    } catch (err) {
        console.error('api/admin/settings:', err);
        return sendError(res, 500, err.message);
    }
}
