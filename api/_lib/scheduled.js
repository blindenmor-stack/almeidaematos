// ============================================================================
// Fila de posts prontos (status=scheduled) — escritos à mão ou pelos agentes
// especialistas na sessão do Claude (comando /post-blog-am + scripts/blog.mjs
// schedule). No dia de publicação, o cron publica o agendado mais antigo cuja
// data já chegou (scheduled_for nulo = assim que possível) ANTES de gerar
// qualquer post automático por pauta.
// ============================================================================

import { sbFetch, logGeneration } from './supabase.js';
import { generateCover } from './cover.js';
import { countWords } from './util.js';

/**
 * Publica o próximo post agendado. Retorna null se não houver nenhum vencido.
 * @param {object} [opts] - { triggerSource: 'cron'|'manual' }
 * @returns {Promise<{post, words}|null>}
 */
export async function publishNextScheduled({ triggerSource = 'cron' } = {}) {
    const nowIso = new Date().toISOString();
    const rows = await sbFetch(
        `blog_posts?status=eq.scheduled&or=(scheduled_for.is.null,scheduled_for.lte.${encodeURIComponent(nowIso)})` +
        `&order=scheduled_for.asc.nullsfirst,created_at.asc&limit=1` +
        `&select=id,title,slug,category,cover_url,content_html,origin,scheduled_for`
    );
    if (!rows?.length) return null;

    const post = rows[0];
    const started = Date.now();

    // Capa na identidade da marca, se o post chegou sem uma (best-effort)
    let coverUrl = post.cover_url || null;
    if (!coverUrl) {
        coverUrl = await generateCover({ slug: post.slug, title: post.title, category: post.category });
    }

    const patched = await sbFetch(`blog_posts?id=eq.${post.id}`, {
        method: 'PATCH',
        body: {
            status: 'published',
            published_at: nowIso,
            ...(coverUrl ? { cover_url: coverUrl } : {}),
        },
    });

    const words = countWords(post.content_html);
    const when = post.scheduled_for ? `, agendado para ${String(post.scheduled_for).slice(0, 10)}` : '';
    await logGeneration({
        trigger_source: triggerSource,
        post_id: post.id,
        status: 'success',
        detail: `Publicado post agendado: "${post.title}" (${words} palavras, origem ${post.origin}${when})`,
        model: 'agendado',
        duration_ms: Date.now() - started,
    });

    return { post: patched[0], words };
}
