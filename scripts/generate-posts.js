/**
 * Post-build SSG: gera HTML estático para cada post do blog.
 * Roda após `vite build` e cria dist/{slug}/index.html com conteúdo real.
 *
 * Benefícios SEO:
 * - Googlebot vê conteúdo, title, meta tags sem executar JS
 * - Social sharing (WhatsApp, Facebook) funciona com OG tags reais
 * - Structured data (JSON-LD) presente no HTML
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';

const DIST = resolve(import.meta.dirname, '..', 'dist');
const POSTS_DIR = join(DIST, 'blog', 'posts');
const SITE_URL = 'https://almeidaematos.com.br';

// Ler template (blog-post.html buildado)
const template = readFileSync(join(DIST, 'blog-post.html'), 'utf-8');

// Ler posts-data.json
const postsData = JSON.parse(readFileSync(join(POSTS_DIR, 'posts-data.json'), 'utf-8'));

function formatDate(dateStr) {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

let generated = 0;
let errors = 0;

for (const postMeta of postsData) {
    try {
        const postFile = join(POSTS_DIR, `${postMeta.slug}.json`);
        if (!existsSync(postFile)) continue;

        const post = { ...postMeta, ...JSON.parse(readFileSync(postFile, 'utf-8')) };
        if (!post.author) post.author = 'Equipe Almeida & Matos';
        if (!post.readTime) {
            const wordCount = (post.content || '').replace(/<[^>]+>/g, '').split(/\s+/).length;
            post.readTime = Math.max(1, Math.ceil(wordCount / 200)) + ' min';
        }

        let html = template;

        // Title
        html = html.replace(
            /<title[^>]*>.*?<\/title>/,
            `<title>${escapeHtml(post.title)} | Almeida &amp; Matos Advogados</title>`
        );

        // Meta description
        html = html.replace(
            /<meta name="description"[^>]*>/,
            `<meta name="description" content="${escapeHtml(post.excerpt)}">`
        );

        // Canonical
        html = html.replace(
            /<link rel="canonical"[^>]*>/,
            `<link rel="canonical" href="${SITE_URL}/${post.slug}/">`
        );

        // OG tags
        html = html.replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${escapeHtml(post.title)}">`);
        html = html.replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${escapeHtml(post.excerpt)}">`);
        html = html.replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${SITE_URL}/${post.slug}/">`);

        // Add og:image (before </head>)
        html = html.replace(
            '</head>',
            `    <meta property="og:image" content="${SITE_URL}/img/og-cover.jpg">\n    <meta property="og:image:width" content="1500">\n    <meta property="og:image:height" content="788">\n</head>`
        );

        // Breadcrumb title
        html = html.replace(
            /<span id="breadcrumb-title"[^>]*>.*?<\/span>/,
            `<span id="breadcrumb-title" class="text-navy-600">${escapeHtml(post.title)}</span>`
        );

        // Category
        html = html.replace(
            /<div id="post-category"[^>]*>.*?<\/div>/,
            `<div id="post-category" class="blog-card-category mb-4">${escapeHtml(post.category)}</div>`
        );

        // H1 Title
        html = html.replace(
            /<h1 id="post-title"[^>]*>.*?<\/h1>/,
            `<h1 id="post-title" class="heading-1 font-serif text-navy-950 mb-4">${escapeHtml(post.title)}</h1>`
        );

        // Meta info (date, readTime, author)
        html = html.replace(
            /<div id="post-meta"[^>]*>[\s\S]*?<!-- Filled by JS -->[\s\S]*?<\/div>/,
            `<div id="post-meta" class="post-meta">
                <div class="post-meta-item">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    ${formatDate(post.date)}
                </div>
                <div class="post-meta-item">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    ${post.readTime} de leitura
                </div>
                <div class="post-meta-item">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    ${post.author}
                </div>
            </div>`
        );

        // Content (replace skeleton)
        html = html.replace(
            /<div id="post-content"[\s\S]*?<\/div>\s*(?=\n\s*<!-- Post CTA)/,
            `<div id="post-content" class="article-content">\n                            ${post.content}\n                        </div>\n`
        );

        // Structured data (JSON-LD)
        const schema = JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: post.title,
            description: post.excerpt,
            image: `${SITE_URL}/img/og-cover.jpg`,
            datePublished: post.date,
            dateModified: post.date,
            author: { '@type': 'Organization', name: 'Almeida & Matos Advogados', url: SITE_URL },
            publisher: {
                '@type': 'Organization',
                name: 'Almeida & Matos Advogados',
                url: SITE_URL,
                logo: { '@type': 'ImageObject', url: `${SITE_URL}/img/logo-am-oficial.webp` }
            },
            mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/${post.slug}/` }
        });
        html = html.replace('</head>', `    <script type="application/ld+json">${schema}</script>\n</head>`);

        // Write to dist/{slug}/index.html
        const outDir = join(DIST, post.slug);
        mkdirSync(outDir, { recursive: true });
        writeFileSync(join(outDir, 'index.html'), html, 'utf-8');
        generated++;
    } catch (e) {
        console.error(`Erro em ${postMeta.slug}: ${e.message}`);
        errors++;
    }
}

console.log(`SSG: ${generated} posts gerados, ${errors} erros`);
