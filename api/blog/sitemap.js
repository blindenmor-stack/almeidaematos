// ============================================================================
// GET /api/blog/sitemap — sitemap.xml completo do site
// home + /blog/ + hub e páginas de produto + 491 posts estáticos (do
// posts-data.json empacotado com a function) + posts published do Supabase.
//
// IMPORTANTE (config do orquestrador no vercel.json):
//   "functions": { "api/blog/sitemap.js": { "includeFiles": "public/blog/posts/posts-data.json" } }
//   e rewrite "/sitemap.xml" → "/api/blog/sitemap" (detalhes em docs/BLOG-SYSTEM.md)
// ============================================================================

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sbFetch } from '../_lib/supabase.js';
import { toSaoPauloYMD, esc, sendError } from '../_lib/util.js';

const SITE_URL = 'https://almeidaematos.com.br';

// lastmod fixo das páginas institucionais (atualizar em redesigns)
const STATIC_LASTMOD = '2026-07-01';

const PRODUCT_SLUGS = [
    'auxilio-acidente', 'auxilio-doenca', 'bpc-loas', 'aposentadoria-por-invalidez',
    'pensao-por-morte', 'aposentadoria-pcd', 'indenizacao-civel-trabalhista',
];

/** Lê o posts-data.json empacotado (tenta caminhos possíveis do bundle da Vercel). */
function readLegacyPosts() {
    const candidates = [
        join(process.cwd(), 'public', 'blog', 'posts', 'posts-data.json'),
        join(process.cwd(), 'blog', 'posts', 'posts-data.json'),
    ];
    for (const p of candidates) {
        try {
            return JSON.parse(readFileSync(p, 'utf-8'));
        } catch { /* tenta o próximo */ }
    }
    console.warn('sitemap: posts-data.json não encontrado no bundle (verifique includeFiles)');
    return [];
}

function urlEntry(loc, lastmod, priority) {
    return `  <url>\n    <loc>${esc(loc)}</loc>` +
        (lastmod ? `\n    <lastmod>${esc(lastmod)}</lastmod>` : '') +
        (priority ? `\n    <priority>${priority}</priority>` : '') +
        '\n  </url>';
}

export default async function handler(req, res) {
    try {
        if (req.method !== 'GET') {
            return sendError(res, 405, 'Método não permitido');
        }

        const entries = [];

        // 1. Páginas fixas
        entries.push(urlEntry(`${SITE_URL}/`, STATIC_LASTMOD, '1.0'));
        entries.push(urlEntry(`${SITE_URL}/blog/`, STATIC_LASTMOD, '0.8'));
        entries.push(urlEntry(`${SITE_URL}/beneficios/`, STATIC_LASTMOD, '0.9'));
        for (const slug of PRODUCT_SLUGS) {
            entries.push(urlEntry(`${SITE_URL}/beneficios/${slug}/`, STATIC_LASTMOD, '0.9'));
        }

        // 2. Posts legados (SSG) — do posts-data.json no filesystem
        const legacy = readLegacyPosts();
        const legacySlugs = new Set();
        for (const p of legacy) {
            if (!p.slug) continue;
            legacySlugs.add(p.slug);
            entries.push(urlEntry(`${SITE_URL}/${p.slug}/`, p.date || null, '0.6'));
        }

        // 3. Posts do banco (published) — dedup contra legados por segurança
        let dbPosts = [];
        try {
            dbPosts = await sbFetch(
                'blog_posts?status=eq.published&select=slug,published_at,updated_at&order=published_at.desc&limit=1000'
            ) || [];
        } catch (e) {
            // Banco fora do ar não pode derrubar o sitemap dos 491 posts legados
            console.error('sitemap: falha ao ler posts do Supabase:', e.message);
        }
        for (const p of dbPosts) {
            if (!p.slug || legacySlugs.has(p.slug)) continue;
            const lastmod = toSaoPauloYMD(p.updated_at || p.published_at);
            entries.push(urlEntry(`${SITE_URL}/${p.slug}/`, lastmod, '0.7'));
        }

        const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
            entries.join('\n') +
            '\n</urlset>\n';

        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
        return res.status(200).send(xml);
    } catch (err) {
        console.error('api/blog/sitemap:', err);
        return sendError(res, 500, 'Erro ao gerar sitemap', err.message);
    }
}
