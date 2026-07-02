/**
 * Post-build SSG: gera HTML estático para cada post do blog (template v2).
 * Roda após `vite build` e cria dist/{slug}/index.html com conteúdo real.
 *
 * Benefícios SEO:
 * - Googlebot vê conteúdo, title, meta tags sem executar JS
 * - Social sharing (WhatsApp, Facebook) funciona com OG tags reais
 * - Structured data (JSON-LD Article) presente no HTML
 *
 * Também gera dist/llms.txt (llmstxt.org) com páginas principais + posts recentes.
 *
 * IMPORTANTE: os marcadores abaixo (ids/comentários) precisam existir no
 * blog-post.html. Cada replace valida se casou — se o template mudar sem
 * atualizar este script, o build acusa erro em vez de gerar página quebrada.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';

const DIST = resolve(import.meta.dirname, '..', 'dist');
const POSTS_DIR = join(DIST, 'blog', 'posts');
const SITE_URL = 'https://almeidaematos.com.br';

// Ler template (blog-post.html buildado pelo Vite)
const template = readFileSync(join(DIST, 'blog-post.html'), 'utf-8');

// Ler posts-data.json
const postsData = JSON.parse(readFileSync(join(POSTS_DIR, 'posts-data.json'), 'utf-8'));

function formatDate(dateStr) {
    const date = new Date(String(dateStr).slice(0, 10) + 'T12:00:00');
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Replace com validação: se o marcador não existir no template, lança erro.
// O replacement vai via função para o JS não interpretar padrões especiais
// ($&, $$, $`) presentes no conteúdo dos posts (ex: "R$&nbsp;1.200").
function replaceOnce(html, regex, replacement, label) {
    if (!regex.test(html)) throw new Error(`Marcador não encontrado no template: ${label}`);
    return html.replace(regex, () => replacement);
}

// Mesmo shape do metaHTML() do blog.js — mantém SSG e client-side idênticos
function metaHTML(post) {
    const parts = [`Publicado em ${formatDate(post.date)}`];
    const modified = post.modified || post.dateModified || post.updated;
    if (modified && String(modified).slice(0, 10) !== String(post.date).slice(0, 10)) {
        parts.push(`Atualizado em ${formatDate(modified)}`);
    }
    parts.push(`${escapeHtml(post.readTime)} de leitura`);
    parts.push(escapeHtml(post.author));
    return parts.map((t) => `<span>${t}</span>`).join('<i aria-hidden="true"></i>');
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

        // Title (preserva o id — blog.js usa document.title, mas mantém consistência)
        html = replaceOnce(html,
            /<title id="page-title"[^>]*>[\s\S]*?<\/title>/,
            `<title id="page-title">${escapeHtml(post.title)} | Almeida &amp; Matos Advogados</title>`,
            'title#page-title'
        );

        // Meta description
        html = replaceOnce(html,
            /<meta name="description" id="page-description"[^>]*>/,
            `<meta name="description" id="page-description" content="${escapeHtml(post.excerpt)}">`,
            'meta#page-description'
        );

        // Canonical
        html = replaceOnce(html,
            /<link rel="canonical" id="page-canonical"[^>]*>/,
            `<link rel="canonical" id="page-canonical" href="${SITE_URL}/${post.slug}/">`,
            'link#page-canonical'
        );

        // OG tags (og:image/width/height já são estáticos no template)
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

        // Breadcrumb title
        html = replaceOnce(html,
            /<span id="breadcrumb-title"[^>]*>[\s\S]*?<\/span>/,
            `<span id="breadcrumb-title">${escapeHtml(post.title)}</span>`,
            'span#breadcrumb-title'
        );

        // Categoria (tag do hero)
        html = replaceOnce(html,
            /<span id="post-category"[^>]*>[\s\S]*?<\/span>/,
            `<span id="post-category" class="post-card__tag post-hero__tag">${escapeHtml(post.category)}</span>`,
            'span#post-category'
        );

        // H1
        html = replaceOnce(html,
            /<h1 id="post-title"[^>]*>[\s\S]*?<\/h1>/,
            `<h1 id="post-title" class="display hero__title">${escapeHtml(post.title)}</h1>`,
            'h1#post-title'
        );

        // Meta do post (datas, leitura, autor)
        html = replaceOnce(html,
            /<div id="post-meta"[^>]*>[\s\S]*?<\/div>/,
            `<div id="post-meta" class="post-hero__meta">${metaHTML(post)}</div>`,
            'div#post-meta'
        );

        // Conteúdo (troca o skeleton pelo HTML real; delimitado por <!-- /post-content -->)
        html = replaceOnce(html,
            /<div id="post-content"[\s\S]*?<!-- \/post-content -->/,
            `<div id="post-content" class="prose post-body" data-ssg="1">\n${post.content}\n                    </div>\n                    <!-- /post-content -->`,
            'div#post-content'
        );

        // Structured data (JSON-LD Article) — datas em ISO 8601
        const modified = post.modified || post.dateModified || post.updated || post.date;
        const schema = JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: post.title,
            description: post.excerpt,
            image: `${SITE_URL}/img/og-cover.jpg`,
            datePublished: post.date,
            dateModified: modified,
            inLanguage: 'pt-BR',
            author: { '@type': 'Organization', name: 'Equipe Almeida & Matos', url: SITE_URL },
            publisher: {
                '@type': 'Organization',
                name: 'Almeida & Matos Advogados',
                url: SITE_URL,
                logo: { '@type': 'ImageObject', url: `${SITE_URL}/img/logo-am-oficial.webp` }
            },
            mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/${post.slug}/` }
        });
        html = replaceOnce(html,
            /<\/head>/,
            `    <script type="application/ld+json" data-am-article>${schema}</script>\n</head>`,
            '</head> (JSON-LD)'
        );

        // Escrever dist/{slug}/index.html
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
if (errors > 0) {
    // Falha o build (deploy não sai) — perder páginas legadas silenciosamente
    // seria desindexação em massa do principal ativo de SEO.
    console.error(`SSG FALHOU: ${errors} post(s) com erro — build abortado para proteger as URLs legadas.`);
    process.exitCode = 1;
}

// posts-preview.json — os 12 mais recentes (a home busca este arquivo em vez
// dos ~257KB do posts-data.json completo)
try {
    const preview = [...postsData]
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
        .slice(0, 12);
    writeFileSync(join(DIST, 'blog', 'posts', 'posts-preview.json'), JSON.stringify(preview), 'utf-8');
    console.log('posts-preview.json gerado (12 posts)');
} catch (e) {
    console.warn('posts-preview.json não gerado:', e.message);
}

// ============================================================
// llms.txt (llmstxt.org) — páginas principais + posts recentes
// ============================================================
try {
    const recentPosts = [...postsData]
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
        .slice(0, 30);

    const mainPages = [
        ['Início', '/', 'Apresentação do escritório, áreas de atuação, como funciona o atendimento e canais de contato.'],
        ['Benefícios (hub)', '/beneficios/', 'Central com todos os benefícios e direitos em que o escritório atua, com guia de cada um.'],
        ['Auxílio-Acidente', '/beneficios/auxilio-acidente/', 'Indenização mensal do INSS para quem ficou com sequela permanente após acidente — mesmo continuando a trabalhar.'],
        ['Auxílio-Doença', '/beneficios/auxilio-doenca/', 'Benefício por incapacidade temporária para o segurado que precisa se afastar do trabalho por doença ou acidente.'],
        ['BPC/LOAS', '/beneficios/bpc-loas/', 'Benefício assistencial de um salário mínimo para idosos 65+ e pessoas com deficiência em situação de baixa renda.'],
        ['Aposentadoria por Invalidez', '/beneficios/aposentadoria-por-invalidez/', 'Benefício por incapacidade permanente para quem não pode mais exercer atividade de trabalho.'],
        ['Pensão por Morte', '/beneficios/pensao-por-morte/', 'Benefício pago aos dependentes do segurado do INSS que faleceu.'],
        ['Aposentadoria PCD', '/beneficios/aposentadoria-pcd/', 'Aposentadoria com regras e prazos diferenciados para pessoas com deficiência.'],
        ['Indenização Cível e Trabalhista', '/beneficios/indenizacao-civel-trabalhista/', 'Reparação por acidentes com responsabilidade de terceiros ou do empregador: seguros, danos morais e materiais.'],
        ['Blog', '/blog/', 'Artigos educativos sobre direito acidentário, previdenciário e trabalhista.'],
    ];

    const llms = [
        '# Almeida & Matos Advogados',
        '',
        '> Escritório de advocacia fundado em 2015, em Barueri (SP), especialista em direito acidentário e previdenciário: auxílio-acidente, benefícios por incapacidade do INSS, BPC/LOAS, pensão por morte e indenizações. Mais de 11 anos de atuação e 10.000+ clientes atendidos em todo o Brasil. Contato: WhatsApp (11) 93004-4411.',
        '',
        '## Páginas principais',
        '',
        ...mainPages.map(([name, path, desc]) => `- [${name}](${SITE_URL}${path}): ${desc}`),
        '',
        '## Blog',
        '',
        ...recentPosts.map((p) => `- [${p.title}](${SITE_URL}/${p.slug}/)`),
        '',
    ].join('\n');

    writeFileSync(join(DIST, 'llms.txt'), llms, 'utf-8');
    console.log(`llms.txt gerado (${mainPages.length} páginas + ${recentPosts.length} posts)`);
} catch (e) {
    console.error(`Erro ao gerar llms.txt: ${e.message}`);
}
