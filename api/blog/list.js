// ============================================================================
// GET /api/blog/list?limit=&offset=&category= — lista posts published (público)
// Retorna JSON no MESMO shape do posts-data.json, pro front do /blog/ poder
// mesclar posts do banco com os 491 legados sem adaptação.
// ============================================================================

import { sbFetch } from '../_lib/supabase.js';
import { toSaoPauloYMD, sendError, SLUG_RE } from '../_lib/util.js';

export default async function handler(req, res) {
    try {
        if (req.method !== 'GET') {
            return sendError(res, 405, 'Método não permitido');
        }

        const limit = Math.min(Math.max(parseInt(req.query?.limit, 10) || 50, 1), 200);
        const offset = Math.max(parseInt(req.query?.offset, 10) || 0, 0);
        const category = String(req.query?.category || '').trim();

        let path = 'blog_posts?status=eq.published'
            + '&select=title,slug,excerpt,category,category_slug,author,read_time,published_at'
            + `&order=published_at.desc&limit=${limit}&offset=${offset}`;

        if (category) {
            if (!SLUG_RE.test(category)) return sendError(res, 400, 'Categoria inválida');
            path += `&category_slug=eq.${encodeURIComponent(category)}`;
        }

        const rows = await sbFetch(path);

        // Shape idêntico ao posts-data.json
        const posts = (rows || []).map((p) => ({
            title: p.title,
            slug: p.slug,
            date: toSaoPauloYMD(p.published_at),
            excerpt: p.excerpt || '',
            category: p.category || '',
            categorySlug: p.category_slug || '',
            author: p.author || 'Equipe Almeida & Matos',
            readTime: p.read_time || '',
        }));

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
        return res.status(200).json(posts);
    } catch (err) {
        console.error('api/blog/list:', err);
        return sendError(res, 500, 'Erro ao listar posts', err.message);
    }
}
