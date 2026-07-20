// ============================================================================
// GET /api/blog/post?slug={slug} — página HTML completa de um post do banco
// Público. É o destino do rewrite de slug quando não existe HTML estático
// (arquivos físicos do SSG têm precedência sobre rewrites na Vercel).
// ============================================================================

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sbFetch } from '../_lib/supabase.js';
import { SLUG_RE, sendError } from '../_lib/util.js';
import { renderPostPage, renderNotFoundPage } from '../_lib/template.js';
import { renderPost, fromDbRow } from '../_lib/post-renderer.js';

// Template real do blog (o mesmo que os ~491 posts do acervo usam), lido do
// build. Cacheado no módulo: a function reaproveita entre invocações quentes.
// Incluído no bundle via `includeFiles` no vercel.json.
let cachedTemplate;
function blogTemplate() {
    if (cachedTemplate !== undefined) return cachedTemplate;
    try {
        cachedTemplate = readFileSync(join(process.cwd(), 'dist', 'blog-post.html'), 'utf-8');
    } catch (err) {
        // Sem o template o post ainda sai, com o layout simplificado do
        // template.js — melhor que 500. O log denuncia pra corrigir.
        console.error('blog-post.html não encontrado no bundle:', err.message);
        cachedTemplate = null;
    }
    return cachedTemplate;
}

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

        // Mesmo template dos posts do acervo. Só cai no layout antigo se o
        // arquivo do build não vier no bundle.
        const template = blogTemplate();
        if (template) {
            try {
                return res.status(200).send(renderPost(template, fromDbRow(rows[0])));
            } catch (err) {
                console.error('renderPost falhou, usando template de fallback:', err.message);
            }
        }
        return res.status(200).send(renderPostPage(rows[0]));
    } catch (err) {
        console.error('api/blog/post:', err);
        return sendError(res, 500, 'Erro ao carregar o artigo', err.message);
    }
}
