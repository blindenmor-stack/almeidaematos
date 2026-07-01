// ============================================================================
// Template HTML do post público — renderização server-side em /api/blog/post
//
// Decisão: o CSS é embutido (standalone) em vez de importar o style.css do
// site porque o Vite gera assets com hash imprevisível (/assets/style-XXXX.css).
// O template replica os tokens do docs/DESIGN-SYSTEM-V2.md (navy #354271,
// dourado #D2AE6D, Archivo + Plus Jakarta Sans, filetes dourados) — assim o
// post fica visualmente coerente e imune a mudanças de bundling.
// ============================================================================

import { esc } from './util.js';

const SITE_URL = 'https://almeidaematos.com.br';
const WHATSAPP_URL = 'https://wa.me/5511930044411?text=' +
    encodeURIComponent('Olá! Li o artigo no site e gostaria de saber sobre meus direitos.');

/** Data 'YYYY-MM-DD' ou ISO → '12 de junho de 2026'. */
function formatDateBR(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'long', year: 'numeric',
    }).format(d);
}

/** JSON-LD: Article + BreadcrumbList + FAQPage (quando houver faq). */
function buildJsonLd(post) {
    const url = `${SITE_URL}/${post.slug}/`;
    const published = post.published_at || post.created_at;

    const article = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: post.title,
        description: post.excerpt || post.meta_description || '',
        image: `${SITE_URL}/img/og-cover.jpg`,
        datePublished: published,
        dateModified: post.updated_at || published,
        author: { '@type': 'Organization', name: 'Almeida & Matos Advogados', url: SITE_URL },
        publisher: {
            '@type': 'Organization',
            name: 'Almeida & Matos Advogados',
            url: SITE_URL,
            logo: { '@type': 'ImageObject', url: `${SITE_URL}/img/logo-am-oficial.webp` },
        },
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    };

    const breadcrumb = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Início', item: `${SITE_URL}/` },
            { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog/` },
            { '@type': 'ListItem', position: 3, name: post.title, item: url },
        ],
    };

    const schemas = [article, breadcrumb];

    if (Array.isArray(post.faq) && post.faq.length) {
        schemas.push({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: post.faq.map((f) => ({
                '@type': 'Question',
                name: f.question,
                acceptedAnswer: { '@type': 'Answer', text: f.answer },
            })),
        });
    }

    return schemas
        .map((s) => `<script type="application/ld+json">${JSON.stringify(s).replace(/</g, '\\u003c')}</script>`)
        .join('\n    ');
}

/** Bloco visível de FAQ no fim do artigo (se o content_html já não tiver um). */
function buildFaqBlock(post) {
    if (!Array.isArray(post.faq) || !post.faq.length) return '';
    // Evita duplicar se a IA já incluiu a seção no corpo
    if (/perguntas\s+frequentes/i.test(post.content_html || '')) return '';
    return `
            <section class="post-faq">
                <h2>Perguntas frequentes</h2>
                ${post.faq.map((f) => `
                <div class="faq-item">
                    <h3>${esc(f.question)}</h3>
                    <p>${esc(f.answer)}</p>
                </div>`).join('')}
            </section>`;
}

const BASE_CSS = `
:root{--navy-950:#0D1226;--navy-900:#141B38;--navy-800:#1F2A52;--navy-700:#354271;--navy-600:#43538C;--navy-300:#97A3CC;--navy-100:#DFE3F0;--navy-50:#F0F2F8;--gold-700:#8F7340;--gold-600:#B8935A;--gold-500:#D2AE6D;--gold-300:#E2C893;--gold-100:#F8F1E1;--gray-500:#848688;--paper:#F7F5F0;--ink:#10162E;--whatsapp:#25D366}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Plus Jakarta Sans',system-ui,sans-serif;background:var(--paper);color:var(--ink);line-height:1.7;-webkit-font-smoothing:antialiased}
.topbar{height:4px;background:var(--gold-500)}
header.site-header{background:var(--navy-900);padding:.9rem 1.25rem}
.header-inner{max-width:1080px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:1rem}
.header-inner img{height:44px;width:auto;display:block}
.header-nav{display:flex;gap:1.5rem;align-items:center}
.header-nav a{color:var(--navy-100);text-decoration:none;font-size:.9rem;font-weight:600}
.header-nav a:hover{color:var(--gold-300)}
.header-nav a.nav-cta{background:var(--gold-500);color:var(--navy-950);padding:.5rem 1.1rem;border-radius:999px;font-weight:700}
main{max-width:760px;margin:0 auto;padding:2.5rem 1.25rem 4rem}
.breadcrumb{font-size:.8rem;color:var(--gray-500);margin-bottom:1.75rem}
.breadcrumb a{color:var(--navy-600);text-decoration:none}
.breadcrumb a:hover{color:var(--gold-600)}
.post-category{display:inline-block;font-size:.75rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-600);border-bottom:3px solid var(--gold-500);padding-bottom:.3rem;margin-bottom:1.1rem}
h1{font-family:'Archivo',sans-serif;font-weight:800;font-size:clamp(1.9rem,4.5vw,2.75rem);line-height:1.12;letter-spacing:-.02em;color:var(--navy-700);margin-bottom:1rem}
.post-meta{display:flex;flex-wrap:wrap;gap:1.25rem;font-size:.85rem;color:var(--gray-500);padding-bottom:1.5rem;border-bottom:1px solid var(--navy-100);margin-bottom:2rem}
.article-content h2{font-family:'Archivo',sans-serif;font-weight:700;font-size:clamp(1.35rem,2.6vw,1.7rem);line-height:1.25;color:var(--navy-700);margin:2.25rem 0 .85rem;padding-top:.85rem;border-top:3px solid var(--gold-500);display:block}
.article-content h3{font-family:'Archivo',sans-serif;font-weight:700;font-size:1.15rem;color:var(--navy-800);margin:1.6rem 0 .6rem}
.article-content p{margin-bottom:1.1rem}
.article-content ul,.article-content ol{margin:0 0 1.25rem 1.4rem}
.article-content li{margin-bottom:.45rem}
.article-content a{color:var(--navy-600);font-weight:600;text-decoration:underline;text-decoration-color:var(--gold-500);text-underline-offset:3px}
.article-content a:hover{color:var(--gold-700)}
.article-content table{width:100%;border-collapse:collapse;margin:1.25rem 0;font-size:.92rem}
.article-content th{background:var(--navy-700);color:#fff;text-align:left;padding:.6rem .8rem;font-weight:600}
.article-content td{padding:.6rem .8rem;border-bottom:1px solid var(--navy-100)}
.article-content tr:nth-child(even) td{background:var(--navy-50)}
.article-content strong{color:var(--navy-800)}
.post-faq{margin-top:2.5rem}
.post-faq h2{font-family:'Archivo',sans-serif;font-weight:700;font-size:1.6rem;color:var(--navy-700);margin-bottom:1rem;padding-top:.85rem;border-top:3px solid var(--gold-500)}
.faq-item{background:#fff;border:1px solid var(--navy-100);border-top:3px solid var(--gold-500);border-radius:10px;padding:1.1rem 1.25rem;margin-bottom:.85rem}
.faq-item h3{font-family:'Archivo',sans-serif;font-size:1.02rem;font-weight:700;color:var(--navy-800);margin-bottom:.45rem}
.faq-item p{font-size:.95rem;color:#3A4258}
.post-cta{margin-top:3rem;background:var(--navy-900);border-radius:14px;padding:2rem 1.75rem;text-align:center;position:relative;overflow:hidden}
.post-cta::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:var(--gold-500)}
.post-cta h2{font-family:'Archivo',sans-serif;font-weight:800;font-size:1.45rem;color:#fff;margin-bottom:.5rem}
.post-cta p{color:var(--navy-100);font-size:.95rem;margin-bottom:1.25rem}
.btn-whatsapp{display:inline-flex;align-items:center;gap:.55rem;background:var(--whatsapp);color:#fff;font-weight:700;font-size:.98rem;padding:.8rem 1.6rem;border-radius:999px;text-decoration:none}
.btn-whatsapp:hover{filter:brightness(1.06)}
.post-cta .risk-reducer{font-size:.8rem;color:var(--navy-300);margin-top:.75rem;margin-bottom:0}
footer.site-footer{background:var(--navy-950);color:var(--navy-300);padding:2.25rem 1.25rem;font-size:.85rem}
.footer-inner{max-width:1080px;margin:0 auto;display:flex;flex-wrap:wrap;justify-content:space-between;gap:1rem;align-items:center}
.footer-inner img{height:38px;width:auto;opacity:.9}
.footer-inner a{color:var(--navy-100);text-decoration:none}
.footer-inner a:hover{color:var(--gold-300)}
@media(max-width:640px){.header-nav a:not(.nav-cta){display:none}.post-meta{gap:.85rem}}
`;

/**
 * Renderiza a página HTML completa de um post do banco.
 * @param {object} post - linha de aquisicao.blog_posts (status published)
 */
export function renderPostPage(post) {
    const url = `${SITE_URL}/${post.slug}/`;
    const title = post.meta_title || post.title;
    const description = post.meta_description || post.excerpt || '';
    const dateStr = formatDateBR(post.published_at || post.created_at);

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(title)} | Almeida &amp; Matos Advogados</title>
    <meta name="description" content="${esc(description)}">
    <link rel="canonical" href="${esc(url)}">
    <link rel="icon" href="/favicon.ico">
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="Almeida &amp; Matos Advogados">
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(description)}">
    <meta property="og:url" content="${esc(url)}">
    <meta property="og:image" content="${SITE_URL}/img/og-cover.jpg">
    <meta property="og:image:width" content="1500">
    <meta property="og:image:height" content="788">
    <meta property="og:locale" content="pt_BR">
    <meta name="twitter:card" content="summary_large_image">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet">
    ${buildJsonLd(post)}
    <style>${BASE_CSS}</style>
</head>
<body>
    <div class="topbar"></div>
    <header class="site-header">
        <div class="header-inner">
            <a href="/"><img src="/img/logo-am-oficial.webp" alt="Almeida &amp; Matos Advogados"></a>
            <nav class="header-nav">
                <a href="/">Início</a>
                <a href="/beneficios/">Benefícios</a>
                <a href="/blog/">Blog</a>
                <a class="nav-cta" href="${WHATSAPP_URL}" target="_blank" rel="noopener">Fale com um especialista</a>
            </nav>
        </div>
    </header>

    <main>
        <nav class="breadcrumb" aria-label="Breadcrumb">
            <a href="/">Início</a> &nbsp;/&nbsp; <a href="/blog/">Blog</a> &nbsp;/&nbsp; ${esc(post.title)}
        </nav>

        <article>
            ${post.category ? `<div class="post-category">${esc(post.category)}</div>` : ''}
            <h1>${esc(post.title)}</h1>
            <div class="post-meta">
                ${dateStr ? `<span>${esc(dateStr)}</span>` : ''}
                ${post.read_time ? `<span>${esc(post.read_time)} de leitura</span>` : ''}
                <span>${esc(post.author || 'Equipe Almeida & Matos')}</span>
            </div>

            <div class="article-content">
                ${post.content_html || ''}
            </div>
            ${buildFaqBlock(post)}

            <div class="post-cta">
                <h2>Ficou com alguma dúvida sobre o seu caso?</h2>
                <p>Nossa equipe analisa a sua situação e explica, sem juridiquês, o que você pode ter direito.</p>
                <a class="btn-whatsapp" href="${WHATSAPP_URL}" target="_blank" rel="noopener">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    Falar com um especialista
                </a>
                <p class="risk-reducer">Sem custo. Sem compromisso.</p>
            </div>
        </article>
    </main>

    <footer class="site-footer">
        <div class="footer-inner">
            <img src="/img/logo-am-oficial.webp" alt="Almeida &amp; Matos Advogados">
            <span>Escritório fundado em 2015 · Especialistas em acidentes e incapacidade</span>
            <span><a href="/blog/">Blog</a> · <a href="/beneficios/">Benefícios</a> · <a href="${WHATSAPP_URL}" target="_blank" rel="noopener">WhatsApp</a></span>
        </div>
    </footer>
</body>
</html>`;
}

/** Página 404 do post (noindex, canonical na home pra evitar soft-404). */
export function renderNotFoundPage() {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Artigo não encontrado | Almeida &amp; Matos Advogados</title>
    <meta name="robots" content="noindex, nofollow">
    <link rel="canonical" href="${SITE_URL}/">
    <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@800&family=Plus+Jakarta+Sans:wght@400;600&display=swap" rel="stylesheet">
    <style>${BASE_CSS}
    .nf{max-width:560px;margin:5rem auto;text-align:center;padding:0 1.25rem}
    .nf h1{margin-bottom:.75rem}.nf p{color:var(--gray-500);margin-bottom:1.5rem}
    .nf a.btn{display:inline-block;background:var(--gold-500);color:var(--navy-950);font-weight:700;padding:.75rem 1.5rem;border-radius:999px;text-decoration:none}</style>
</head>
<body>
    <div class="topbar"></div>
    <div class="nf">
        <h1>Artigo não encontrado</h1>
        <p>O artigo que você procura pode ter sido removido ou o link está incorreto.</p>
        <a class="btn" href="/blog/">Voltar ao Blog</a>
    </div>
</body>
</html>`;
}
