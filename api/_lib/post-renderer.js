// ============================================================================
// Renderer único dos posts do blog.
//
// Existe pra que os posts do gerador e os ~491 do acervo sejam a MESMA página:
// mesmo header, mesmo footer, mesmo CSS, mesmo CTA. Antes havia dois templates
// (este arquivo e um HTML montado à mão na function), e eles divergiram — os
// posts novos saíam com um header/footer simplificados.
//
// Fonte do layout: `blog-post.html` DEPOIS do build do Vite (os assets têm hash
// no nome, então o HTML fonte não serve — o CSS não carregaria).
//
// Consumidores:
//   • scripts/generate-posts.js  → build, grava dist/{slug}/index.html
//   • api/blog/post.js           → runtime, serve os posts do banco
// ============================================================================

const SITE_URL = 'https://almeidaematos.com.br';

export function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function formatDateBR(dateStr) {
    const date = new Date(String(dateStr).slice(0, 10) + 'T12:00:00');
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

/**
 * Replace com validação: marcador ausente = template mudou sem avisar, e a
 * página sairia quebrada em silêncio. O replacement vai por função pro JS não
 * interpretar padrões especiais ($&, $$, $`) vindos do conteúdo ("R$&nbsp;1.200").
 */
function replaceOnce(html, regex, replacement, label) {
    if (!regex.test(html)) throw new Error(`Marcador não encontrado no template: ${label}`);
    return html.replace(regex, () => replacement);
}

/** Linha de meta do hero — mesmo shape do metaHTML() do blog.js. */
function metaHTML(post) {
    const parts = [`Publicado em ${formatDateBR(post.date)}`];
    if (post.modified && String(post.modified).slice(0, 10) !== String(post.date).slice(0, 10)) {
        parts.push(`Atualizado em ${formatDateBR(post.modified)}`);
    }
    parts.push(`${escapeHtml(post.readTime)} de leitura`);
    parts.push(escapeHtml(post.author));
    return parts.map((t) => `<span>${t}</span>`).join('<i aria-hidden="true"></i>');
}

function articleSchema(post) {
    return JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: post.title,
        description: post.excerpt,
        image: post.coverUrl || `${SITE_URL}/img/og-cover.jpg`,
        datePublished: post.date,
        dateModified: post.modified || post.date,
        inLanguage: 'pt-BR',
        author: { '@type': 'Organization', name: 'Equipe Almeida & Matos', url: SITE_URL },
        publisher: {
            '@type': 'Organization',
            name: 'Almeida & Matos Advogados',
            url: SITE_URL,
            logo: { '@type': 'ImageObject', url: `${SITE_URL}/img/logo-am-oficial.webp` },
        },
        mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/${post.slug}/` },
    });
}

function faqSchema(faq) {
    return JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faq.map((f) => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: { '@type': 'Answer', text: f.answer },
        })),
    });
}

/**
 * Monta a página final do post.
 *
 * @param {string} template - conteúdo de dist/blog-post.html
 * @param {object} post - { title, slug, excerpt, category, date, modified,
 *                          author, readTime, content, coverUrl?, faq? }
 * @returns {string} HTML completo
 */
export function renderPost(template, post) {
    let html = template;

    html = replaceOnce(html,
        /<title id="page-title"[^>]*>[\s\S]*?<\/title>/,
        `<title id="page-title">${escapeHtml(post.metaTitle || post.title)} | Almeida &amp; Matos Advogados</title>`,
        'title#page-title'
    );

    html = replaceOnce(html,
        /<meta name="description" id="page-description"[^>]*>/,
        `<meta name="description" id="page-description" content="${escapeHtml(post.metaDescription || post.excerpt)}">`,
        'meta#page-description'
    );

    html = replaceOnce(html,
        /<link rel="canonical" id="page-canonical"[^>]*>/,
        `<link rel="canonical" id="page-canonical" href="${SITE_URL}/${post.slug}/">`,
        'link#page-canonical'
    );

    html = replaceOnce(html,
        /<meta property="og:title" id="og-title"[^>]*>/,
        `<meta property="og:title" id="og-title" content="${escapeHtml(post.title)}">`,
        'meta#og-title'
    );
    html = replaceOnce(html,
        /<meta property="og:description" id="og-description"[^>]*>/,
        `<meta property="og:description" id="og-description" content="${escapeHtml(post.excerpt)}">`,
        'meta#og-description'
    );
    html = replaceOnce(html,
        /<meta property="og:url" id="og-url"[^>]*>/,
        `<meta property="og:url" id="og-url" content="${SITE_URL}/${post.slug}/">`,
        'meta#og-url'
    );

    // Capa própria (posts do gerador). Sem capa, fica a og:image padrão do template.
    if (post.coverUrl) {
        html = html.replace(
            /<meta property="og:image"[^>]*>/,
            () => `<meta property="og:image" content="${escapeHtml(post.coverUrl)}">`
        );
        html = html.replace(
            /<meta name="twitter:image"[^>]*>/,
            () => `<meta name="twitter:image" content="${escapeHtml(post.coverUrl)}">`
        );
    }

    html = replaceOnce(html,
        /<span id="breadcrumb-title"[^>]*>[\s\S]*?<\/span>/,
        `<span id="breadcrumb-title">${escapeHtml(post.title)}</span>`,
        'span#breadcrumb-title'
    );

    html = replaceOnce(html,
        /<span id="post-category"[^>]*>[\s\S]*?<\/span>/,
        `<span id="post-category" class="post-card__tag post-hero__tag">${escapeHtml(post.category)}</span>`,
        'span#post-category'
    );

    html = replaceOnce(html,
        /<h1 id="post-title"[^>]*>[\s\S]*?<\/h1>/,
        `<h1 id="post-title" class="display hero__title">${escapeHtml(post.title)}</h1>`,
        'h1#post-title'
    );

    html = replaceOnce(html,
        /<div id="post-meta"[^>]*>[\s\S]*?<\/div>/,
        `<div id="post-meta" class="post-hero__meta">${metaHTML(post)}</div>`,
        'div#post-meta'
    );

    // data-ssg="1" avisa o blog.js que o conteúdo já veio pronto: ele não
    // re-hidrata nem degrada pra not-found (relacionados seguem best-effort).
    html = replaceOnce(html,
        /<div id="post-content"[\s\S]*?<!-- \/post-content -->/,
        `<div id="post-content" class="prose post-body" data-ssg="1">\n${post.content}\n                    </div>\n                    <!-- /post-content -->`,
        'div#post-content'
    );

    const schemas = [`<script type="application/ld+json" data-am-article>${articleSchema(post)}</script>`];
    if (Array.isArray(post.faq) && post.faq.length) {
        schemas.push(`<script type="application/ld+json" data-am-faq>${faqSchema(post.faq)}</script>`);
    }
    html = replaceOnce(html, /<\/head>/, `    ${schemas.join('\n    ')}\n</head>`, '</head> (JSON-LD)');

    return html;
}

/** Linha do banco (blog_posts) → shape que o renderPost espera. */
export function fromDbRow(row) {
    return {
        title: row.title,
        slug: row.slug,
        excerpt: row.excerpt || '',
        category: row.category || 'Artigo',
        date: row.published_at || row.created_at,
        modified: row.updated_at || null,
        author: row.author || 'Equipe Almeida & Matos',
        readTime: row.read_time || '5 min',
        content: row.content_html || '',
        coverUrl: row.cover_url || null,
        faq: Array.isArray(row.faq) ? row.faq : [],
        metaTitle: row.meta_title || null,
        metaDescription: row.meta_description || null,
    };
}
