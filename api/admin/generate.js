// ============================================================================
// POST /api/admin/generate — dispara a geração de 1 post AGORA (manual)
// Body opcional: { topic_id } (pauta existente) ou { topic } (texto livre).
// Requer x-admin-password. Mesma lógica do cron, trigger_source='manual'.
// ============================================================================

import { requireAdmin } from '../_lib/auth.js';
import { generatePost } from '../_lib/generate.js';
import { readJsonBody, sendError } from '../_lib/util.js';

// Geração via Gemini pode demorar — estende o timeout da function
export const config = { maxDuration: 300 };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
    try {
        if (!requireAdmin(req, res)) return;
        if (req.method !== 'POST') {
            return sendError(res, 405, 'Método não permitido');
        }

        const body = await readJsonBody(req).catch(() => ({}));

        let topicId = null;
        let topicText = null;
        if (body.topic_id) {
            if (!UUID_RE.test(String(body.topic_id))) return sendError(res, 400, 'topic_id inválido');
            topicId = String(body.topic_id);
        } else if (body.topic) {
            topicText = String(body.topic).trim().slice(0, 500);
            if (topicText.length < 10) return sendError(res, 400, 'Pauta muito curta (mínimo 10 caracteres)');
        }

        const { post, topic, words } = await generatePost({
            triggerSource: 'manual',
            topicId,
            topicText,
        });

        return res.status(200).json({
            ok: true,
            post: {
                id: post.id,
                title: post.title,
                slug: post.slug,
                status: post.status,
                category: post.category,
                words,
            },
            topic: { id: topic.id, topic: topic.topic },
            url: post.status === 'published' ? `https://almeidaematos.com.br/${post.slug}/` : null,
        });
    } catch (err) {
        console.error('api/admin/generate:', err);
        return sendError(res, 500, 'Falha na geração do post', err.message);
    }
}
