// ================================
// Blog System — Almeida & Matos (v2)
// Roda em: listagem (/blog/), post em dev e post não-SSG.
// Nas páginas SSG o conteúdo já vem no HTML; este script re-hidrata
// meta/related sem quebrar nada.
// ================================

const POSTS_PER_PAGE = 12;
const SITE_URL = 'https://almeidaematos.com.br';

// ================================
// Utilities
// ================================
function esc(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        const date = new Date(String(dateStr).slice(0, 10) + 'T12:00:00');
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch { return dateStr; }
}

function formatDateShort(dateStr) {
    if (!dateStr) return '';
    try {
        const date = new Date(String(dateStr).slice(0, 10) + 'T12:00:00');
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return dateStr; }
}

function slugify(str) {
    return String(str ?? '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'geral';
}

function getSlugFromURL() {
    const path = window.location.pathname;
    const segments = path.replace(/\/$/, '').split('/');
    return segments[segments.length - 1];
}

function isPostPage() {
    return !!document.getElementById('post-content') && !document.getElementById('posts-grid');
}

function normalizePost(p) {
    if (!p || !p.slug) return null;
    const post = { ...p };
    if (!post.category) post.category = 'Direitos';
    if (!post.categorySlug) post.categorySlug = slugify(post.category);
    if (!post.author) post.author = 'Equipe Almeida & Matos';
    if (!post.readTime) {
        const wordCount = String(post.content || post.excerpt || '').replace(/<[^>]+>/g, '').split(/\s+/).length;
        post.readTime = Math.max(1, Math.ceil(wordCount / 200)) + ' min';
    }
    return post;
}

// ================================
// Fetch de posts
// ================================
async function fetchStaticPosts() {
    try {
        const response = await fetch('/blog/posts/posts-data.json');
        if (!response.ok) throw new Error('Failed to fetch posts');
        const data = await response.json();
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error('Error fetching posts:', error);
        return [];
    }
}

// Posts novos (gerados por IA via admin/API) — pode nem existir ainda.
async function fetchApiPosts() {
    try {
        const response = await fetch('/api/blog/list?limit=100');
        if (!response.ok) return [];
        const data = await response.json();
        if (Array.isArray(data)) return data;
        if (data && Array.isArray(data.posts)) return data.posts;
        return [];
    } catch {
        return [];
    }
}

// Merge por slug — API ganha do estático; ordena por data desc
function mergePosts(staticPosts, apiPosts) {
    const seen = new Set();
    return [...apiPosts, ...staticPosts]
        .map(normalizePost)
        .filter((p) => p && !seen.has(p.slug) && seen.add(p.slug))
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

// ================================
// LISTAGEM
// ================================
function renderPostCard(post) {
    return `
        <a href="/${esc(post.slug)}/" class="card post-card" data-category="${esc(post.categorySlug)}">
            ${post.cover ? `<span class="post-card__cover"><img src="${esc(post.cover)}" alt="" loading="lazy"></span>` : ''}
            <span class="post-card__tag">${esc(post.category)}</span>
            <h3>${esc(post.title)}</h3>
            <p class="post-card__excerpt">${esc(post.excerpt || '')}</p>
            <span class="post-card__meta">${formatDateShort(post.date)} · ${esc(post.readTime)} de leitura</span>
        </a>
    `;
}

function renderCategoryFilter(posts) {
    const filterContainer = document.getElementById('category-filter');
    if (!filterContainer) return;

    const seen = new Set();
    const categories = [];
    posts.forEach((p) => {
        if (!seen.has(p.categorySlug)) {
            seen.add(p.categorySlug);
            categories.push({ name: p.category, slug: p.categorySlug });
        }
    });

    categories.sort((a, b) => {
        if (a.slug === 'uncategorized') return 1;
        if (b.slug === 'uncategorized') return -1;
        return a.name.localeCompare(b.name, 'pt-BR');
    });

    filterContainer.innerHTML = `
        <label for="category-select">Filtrar por tema</label>
        <select id="category-select" class="category-select">
            <option value="all">Todas as categorias</option>
            ${categories.map((cat) => `<option value="${esc(cat.slug)}">${esc(cat.name)}</option>`).join('')}
        </select>
    `;

    document.getElementById('category-select').addEventListener('change', (e) => {
        window._blogCurrentCategory = e.target.value;
        window._blogCurrentPage = 1;
        renderPostsPage(window._blogAllPosts);
    });
}

function renderPagination(totalPosts, currentPage) {
    const paginationContainer = document.getElementById('pagination');
    if (!paginationContainer) return;

    const totalPages = Math.ceil(totalPosts / POSTS_PER_PAGE);
    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    let html = '';

    html += `<button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}" aria-label="Página anterior">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
    </button>`;

    for (let i = 1; i <= totalPages; i++) {
        if (totalPages > 7) {
            if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
                html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
            } else if (i === currentPage - 2 || i === currentPage + 2) {
                html += `<span class="pagination-ellipsis">…</span>`;
            }
        } else {
            html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
    }

    html += `<button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}" aria-label="Próxima página">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
        </svg>
    </button>`;

    paginationContainer.innerHTML = html;

    paginationContainer.querySelectorAll('.pagination-btn:not([disabled])').forEach((btn) => {
        btn.addEventListener('click', () => {
            const page = parseInt(btn.dataset.page);
            if (page && page > 0) {
                window._blogCurrentPage = page;
                renderPostsPage(window._blogAllPosts);
                document.getElementById('category-filter')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}

function renderPostsPage(posts) {
    const grid = document.getElementById('posts-grid');
    const noResults = document.getElementById('no-results');
    if (!grid) return;

    const category = window._blogCurrentCategory || 'all';
    const currentPage = window._blogCurrentPage || 1;

    const filtered = category === 'all'
        ? posts
        : posts.filter((p) => p.categorySlug === category);

    if (filtered.length === 0) {
        grid.innerHTML = '';
        noResults?.classList.remove('hidden');
        renderPagination(0, 1);
        return;
    }

    noResults?.classList.add('hidden');

    const start = (currentPage - 1) * POSTS_PER_PAGE;
    const paginated = filtered.slice(start, start + POSTS_PER_PAGE);

    grid.innerHTML = paginated.map(renderPostCard).join('');
    renderPagination(filtered.length, currentPage);
}

async function initListingPage() {
    const [staticPosts, apiPosts] = await Promise.all([fetchStaticPosts(), fetchApiPosts()]);
    const posts = mergePosts(staticPosts, apiPosts);

    const grid = document.getElementById('posts-grid');
    if (!posts.length) {
        if (grid) grid.innerHTML = '';
        document.getElementById('no-results')?.classList.remove('hidden');
        return;
    }

    window._blogAllPosts = posts;
    window._blogCurrentCategory = 'all';
    window._blogCurrentPage = 1;

    renderCategoryFilter(posts);
    renderPostsPage(posts);
}

// ================================
// POST
// ================================
function metaHTML(post) {
    const parts = [`Publicado em ${formatDate(post.date)}`];
    const modified = post.modified || post.dateModified || post.updated;
    if (modified && String(modified).slice(0, 10) !== String(post.date).slice(0, 10)) {
        parts.push(`Atualizado em ${formatDate(modified)}`);
    }
    parts.push(`${esc(post.readTime)} de leitura`);
    parts.push(esc(post.author));
    return parts.map((t) => `<span>${t}</span>`).join('<i aria-hidden="true"></i>');
}

async function initPostPage() {
    const slug = getSlugFromURL();

    // Página SSG completa: o HTML já veio pronto do servidor. Nunca re-hidratar
    // nem degradar para not-found (ex.: falha transitória do posts-data.json
    // não pode injetar noindex numa página válida). Relacionados = best-effort.
    const ssgContent = document.getElementById('post-content');
    if (ssgContent && ssgContent.dataset.ssg) {
        try {
            const staticPostsSsg = (await fetchStaticPosts()).map(normalizePost).filter(Boolean);
            const current = staticPostsSsg.find((p) => p.slug === slug);
            if (current) renderRelatedPosts(staticPostsSsg, current);
        } catch { /* sem relacionados — página segue íntegra */ }
        return;
    }

    const staticPosts = (await fetchStaticPosts()).map(normalizePost).filter(Boolean);

    const postMeta = staticPosts.find((p) => p.slug === slug);

    if (!postMeta) {
        // Post pode ser novo (criado via admin/IA, ainda sem SSG). O rewrite
        // server-side cuida de posts novos — recarrega UMA vez pra dar chance
        // ao servidor; se voltar aqui, é 404 de verdade.
        const isDevTemplate = /blog-post\.html$/i.test(window.location.pathname);
        if (!isDevTemplate) {
            try {
                const retryKey = 'am_post_retry:' + slug;
                if (!sessionStorage.getItem(retryKey)) {
                    sessionStorage.setItem(retryKey, '1');
                    window.location.replace(window.location.pathname + window.location.search);
                    return;
                }
            } catch { /* sessionStorage indisponível — segue pro not found */ }
        }
        renderPostNotFound();
        return;
    }

    // Conteúdo completo do post
    let post = postMeta;
    try {
        const resp = await fetch(`/blog/posts/${slug}.json`);
        if (resp.ok) {
            const fullPost = await resp.json();
            post = normalizePost({ ...postMeta, ...fullPost });
        }
    } catch {
        console.warn('Could not fetch full post content, using metadata only');
    }

    // Meta da página
    document.title = `${post.title} | Almeida & Matos Advogados`;
    document.getElementById('page-description')?.setAttribute('content', post.excerpt || '');
    document.getElementById('page-canonical')?.setAttribute('href', `${SITE_URL}/${post.slug}/`);
    document.getElementById('og-title')?.setAttribute('content', post.title);
    document.getElementById('og-description')?.setAttribute('content', post.excerpt || '');
    document.getElementById('og-url')?.setAttribute('content', `${SITE_URL}/${post.slug}/`);

    // Breadcrumb
    const breadcrumbTitle = document.getElementById('breadcrumb-title');
    if (breadcrumbTitle) breadcrumbTitle.textContent = post.title;

    // Categoria
    const categoryEl = document.getElementById('post-category');
    if (categoryEl) categoryEl.textContent = post.category;

    // Título
    const titleEl = document.getElementById('post-title');
    if (titleEl) titleEl.textContent = post.title;

    // Meta (datas, leitura, autor)
    const metaEl = document.getElementById('post-meta');
    if (metaEl) metaEl.innerHTML = metaHTML(post);

    // Conteúdo
    const contentEl = document.getElementById('post-content');
    if (contentEl && post.content) contentEl.innerHTML = post.content;

    // Relacionados
    renderRelatedPosts(staticPosts, post);

    // Schema.org (Article)
    injectStructuredData(post);
}

function renderRelatedPosts(posts, currentPost) {
    const container = document.getElementById('related-posts');
    const list = document.getElementById('related-posts-list');
    if (!container || !list) return;

    let related = posts
        .filter((p) => p.slug !== currentPost.slug && p.categorySlug === currentPost.categorySlug)
        .slice(0, 3);

    if (related.length < 3) {
        const more = posts
            .filter((p) => p.slug !== currentPost.slug && !related.find((r) => r.slug === p.slug))
            .slice(0, 3 - related.length);
        related = [...related, ...more];
    }

    if (related.length === 0) return;

    container.classList.remove('hidden');
    list.innerHTML = related.map(renderPostCard).join('');
}

function renderPostNotFound() {
    // Sinaliza ao Google que esta página não deve ser indexada (evita soft 404)
    const noindex = document.createElement('meta');
    noindex.name = 'robots';
    noindex.content = 'noindex, nofollow';
    document.head.appendChild(noindex);

    // Canonical aponta pra home pra evitar indexação de URL lixo
    document.getElementById('page-canonical')?.setAttribute('href', 'https://almeidaematos.com.br/');

    document.title = 'Artigo não encontrado | Almeida & Matos';
    const titleEl = document.getElementById('post-title');
    if (titleEl) titleEl.textContent = 'Artigo não encontrado';
    const categoryEl = document.getElementById('post-category');
    if (categoryEl) categoryEl.style.display = 'none';
    const metaEl = document.getElementById('post-meta');
    if (metaEl) metaEl.innerHTML = '';
    const breadcrumbTitle = document.getElementById('breadcrumb-title');
    if (breadcrumbTitle) breadcrumbTitle.textContent = 'Não encontrado';

    const contentEl = document.getElementById('post-content');
    if (contentEl) {
        contentEl.innerHTML = `
            <div class="post-notfound">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p class="post-notfound__title">Este artigo não foi encontrado</p>
                <p>O artigo que você procura pode ter sido removido ou o link está incorreto.</p>
                <a href="/blog/" class="btn btn--gold">Voltar ao Blog</a>
            </div>
        `;
    }
    // esconde o CTA do template no estado de erro
    document.querySelector('.post-cta')?.classList.add('hidden');
}

function injectStructuredData(post) {
    // Páginas SSG já trazem o Article JSON-LD — não duplica
    if (document.querySelector('script[data-am-article]')) return;

    const modified = post.modified || post.dateModified || post.updated || post.date;
    const schema = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        'headline': post.title,
        'description': post.excerpt || '',
        'image': `${SITE_URL}/img/og-cover.jpg`,
        'datePublished': post.date,
        'dateModified': modified,
        'inLanguage': 'pt-BR',
        'author': {
            '@type': 'Organization',
            'name': 'Equipe Almeida & Matos',
            'url': SITE_URL,
        },
        'publisher': {
            '@type': 'Organization',
            'name': 'Almeida & Matos Advogados',
            'url': SITE_URL,
            'logo': { '@type': 'ImageObject', 'url': `${SITE_URL}/img/logo-am-oficial.webp` },
        },
        'mainEntityOfPage': {
            '@type': 'WebPage',
            '@id': `${SITE_URL}/${post.slug}/`,
        },
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-am-article', '');
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
}

// ================================
// SHARED: nav v2 (scroll) + menu mobile
// ================================
function initNav() {
    const nav = document.getElementById('nav');
    if (!nav) return;
    let lastY = 0;
    const onScroll = () => {
        const y = window.scrollY;
        nav.classList.toggle('is-scrolled', y > 50);
        nav.classList.toggle('is-hidden',
            y > 480 && y > lastY && !document.body.classList.contains('menu-open'));
        lastY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
}

function initMobileMenu() {
    const burger = document.getElementById('navBurger');
    const mobileMenu = document.getElementById('mobileMenu');
    if (!burger || !mobileMenu) return;

    const closeMenu = () => {
        document.body.classList.remove('menu-open');
        burger.setAttribute('aria-expanded', 'false');
        mobileMenu.setAttribute('aria-hidden', 'true');
    };

    burger.addEventListener('click', () => {
        const open = document.body.classList.toggle('menu-open');
        burger.setAttribute('aria-expanded', String(open));
        mobileMenu.setAttribute('aria-hidden', String(!open));
    });

    mobileMenu.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeMenu));
}

// ================================
// INIT
// ================================
document.addEventListener('DOMContentLoaded', () => {
    initNav();
    initMobileMenu();

    if (isPostPage()) {
        initPostPage();
    } else {
        initListingPage();
    }
});
