// ============================================================================
// GET /api/blog/post?slug={slug} — página HTML completa de um post do banco
// Público. É o destino do rewrite de slug quando não existe HTML estático
// (arquivos físicos do SSG têm precedência sobre rewrites na Vercel).
// ============================================================================

import { sbFetch } from '../_lib/supabase.js';
import { SLUG_RE, sendError } from '../_lib/util.js';
import { renderPostPage, renderNotFoundPage } from '../_lib/template.js';

export default async function handler(req, res) {
    try {
        if (req.method !== 'GET') {
            return sendError(res, 405, 'Método não permitido');
        }

        const slug = String(req.query?.slug || '').replace(/\/+$/, '');
        if (!slug || slug.length > 200 || !SLUG_RE.test(slug)) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', 'public, s-maxage=300');
            return res.status(404).send(renderNotFoundPage());
        }

        const rows = await sbFetch(
            `blog_posts?slug=eq.${encodeURIComponent(slug)}&status=eq.published&limit=1`
        );

        res.setHeader('Content-Type', 'text/html; charset=utf-8');

        if (!rows || !rows.length) {
            // 404 com noindex — evita indexação de URL lixo (cache curto)
            res.setHeader('Cache-Control', 'public, s-maxage=300');
            return res.status(404).send(renderNotFoundPage());
        }

        // Cache CDN 1h + serve stale por 24h enquanto revalida
        res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
        return res.status(200).send(renderPostPage(rows[0]));
    } catch (err) {
        console.error('api/blog/post:', err);
        return sendError(res, 500, 'Erro ao carregar o artigo', err.message);
    }
}
