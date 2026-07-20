// ============================================================================
// GET /api/admin/logs — histórico de execuções do gerador (requer x-admin-password)
//   ?limit=  — quantas linhas (padrão 50, máx 200)
//   ?status= — filtra success|error|skipped
//
// Cada linha do blog_generation_log vira um item com o título do post e da
// pauta resolvidos, pra tela não precisar de N requests extras.
// ============================================================================

import { requireAdmin } from '../_lib/auth.js';
import { sbFetch } from '../_lib/supabase.js';
import { sendError } from '../_lib/util.js';

const STATUSES = ['success', 'error', 'skipped'];

/** Busca títulos de posts/pautas citados nos logs, em 2 queries. */
async function resolveTitles(rows) {
    const postIds = [...new Set(rows.map((r) => r.post_id).filter(Boolean))];
    const topicIds = [...new Set(rows.map((r) => r.topic_id).filter(Boolean))];

    const [posts, topics] = await Promise.all([
        postIds.length
            ? sbFetch(`blog_posts?id=in.(${postIds.join(',')})&select=id,title,slug,status`)
            : Promise.resolve([]),
        topicIds.length
            ? sbFetch(`blog_topics?id=in.(${topicIds.join(',')})&select=id,topic,source`)
            : Promise.resolve([]),
    ]);

    const postById = new Map((posts || []).map((p) => [p.id, p]));
    const topicById = new Map((topics || []).map((t) => [t.id, t]));
    return { postById, topicById };
}

export default async function handler(req, res) {
    try {
        if (!requireAdmin(req, res)) return;
        if (req.method !== 'GET') return sendError(res, 405, 'Método não permitido');

        const limit = Math.min(Math.max(parseInt(req.query?.limit, 10) || 50, 1), 200);
        const status = String(req.query?.status || '').trim();
        if (status && !STATUSES.includes(status)) return sendError(res, 400, 'Status inválido');

        let path = `blog_generation_log?order=run_at.desc&limit=${limit}`;
        if (status) path += `&status=eq.${status}`;

        const rows = (await sbFetch(path)) || [];
        const { postById, topicById } = await resolveTitles(rows);

        const items = rows.map((r) => {
            const post = r.post_id ? postById.get(r.post_id) : null;
            const topic = r.topic_id ? topicById.get(r.topic_id) : null;
            return {
                id: r.id,
                run_at: r.run_at,
                trigger_source: r.trigger_source,
                status: r.status,
                detail: r.detail,
                model: r.model,
                duration_ms: r.duration_ms,
                post: post ? { title: post.title, slug: post.slug, status: post.status } : null,
                topic: topic ? { topic: topic.topic, source: topic.source } : null,
            };
        });

        // Saúde do agendamento: quando foi a última geração bem-sucedida e há
        // quantos dias. É o sinal que denuncia cron quebrado em silêncio, então
        // vem de query própria — não pode depender do filtro nem do limit da
        // listagem (filtrar por "erros" zeraria os sucessos e daria falso alarme).
        const [successRows, errorRows] = await Promise.all([
            sbFetch('blog_generation_log?status=eq.success&order=run_at.desc&limit=1&select=run_at'),
            sbFetch('blog_generation_log?status=eq.error&order=run_at.desc&limit=1&select=run_at,detail'),
        ]);
        const lastSuccess = successRows?.[0] || null;
        const lastError = errorRows?.[0] || null;
        const daysSinceSuccess = lastSuccess
            ? Math.floor((Date.now() - new Date(lastSuccess.run_at).getTime()) / 86400_000)
            : null;

        return res.status(200).json({
            items,
            health: {
                last_success_at: lastSuccess?.run_at || null,
                days_since_success: daysSinceSuccess,
                last_error_at: lastError?.run_at || null,
                last_error_detail: lastError?.detail || null,
            },
        });
    } catch (err) {
        console.error('api/admin/logs:', err);
        return sendError(res, 500, 'Erro ao carregar o histórico', err.message);
    }
}
