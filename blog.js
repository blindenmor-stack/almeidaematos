// ================================
// Blog System — Almeida & Matos
// Handles listing (blog/index.html) and post rendering (blog-post.html)
// ================================

const POSTS_PER_PAGE = 10;
const SITE_URL = 'https://almeidaematos.com.br';

// ================================
// Utilities
// ================================
function formatDate(dateStr) {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });
}

function getSlugFromURL() {
    const path = window.location.pathname;
    // Remove trailing slash and get last segment
    const segments = path.replace(/\/$/, '').split('/');
    return segments[segments.length - 1];
}

function isListingPage() {
    const path = window.location.pathname;
    return path.includes('/blog') && !document.getElementById('post-content');
}

function isPostPage() {
    return !!document.getElementById('post-content');
}

// ================================
// Fetch posts data
// ================================
async function fetchPosts() {
    try {
        // Use absolute paths to avoid issues with slug-based URLs
        const basePath = isPostPage() ? '/blog/posts/posts-data.json' : './posts/posts-data.json';
        const response = await fetch(basePath);
        if (!response.ok) throw new Error('Failed to fetch posts');
        return await response.json();
    } catch (error) {
        console.error('Error fetching posts:', error);
        return [];
    }
}

// ================================
// LISTING PAGE
// ================================
function renderPostCard(post) {
    const imageHTML = post.image
        ? `<img src="${post.image}" alt="${post.title}" class="blog-card-image">`
        : `<div class="blog-card-image-placeholder">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          </div>`;

    return `
        <a href="/${post.slug}/" class="blog-card" data-category="${post.categorySlug}">
            ${imageHTML}
            <div class="blog-card-body">
                <span class="blog-card-category">${post.category}</span>
                <h2 class="blog-card-title">${post.title}</h2>
                <p class="blog-card-excerpt">${post.excerpt}</p>
                <div class="blog-card-meta">
                    <span>
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        ${formatDate(post.date)}
                    </span>
                    <span>
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        ${post.readTime}
                    </span>
                </div>
            </div>
        </a>
    `;
}

function renderCategoryFilter(posts) {
    const filterContainer = document.getElementById('category-filter');
    if (!filterContainer) return;

    // Extract unique categories
    const categories = [...new Set(posts.map(p => JSON.stringify({ name: p.category, slug: p.categorySlug })))]
        .map(c => JSON.parse(c));

    let html = `<button class="category-btn active" data-category="all">Todos</button>`;
    categories.forEach(cat => {
        html += `<button class="category-btn" data-category="${cat.slug}">${cat.name}</button>`;
    });

    filterContainer.innerHTML = html;

    // Attach events
    filterContainer.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            filterContainer.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const category = btn.dataset.category;
            window._blogCurrentCategory = category;
            window._blogCurrentPage = 1;
            renderPostsPage(posts);
        });
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

    // Previous button
    html += `<button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
    </button>`;

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (totalPages > 7) {
            // Show first, last, and pages around current
            if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
                html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
            } else if (i === currentPage - 2 || i === currentPage + 2) {
                html += `<span class="text-navy-400 px-1">...</span>`;
            }
        } else {
            html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
    }

    // Next button
    html += `<button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
        </svg>
    </button>`;

    paginationContainer.innerHTML = html;

    // Attach events
    paginationContainer.querySelectorAll('.pagination-btn:not([disabled])').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = parseInt(btn.dataset.page);
            if (page && page > 0) {
                window._blogCurrentPage = page;
                renderPostsPage(window._blogAllPosts);
                // Scroll to top of posts
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

    // Filter by category
    const filtered = category === 'all'
        ? posts
        : posts.filter(p => p.categorySlug === category);

    if (filtered.length === 0) {
        grid.innerHTML = '';
        noResults?.classList.remove('hidden');
        renderPagination(0, 1);
        return;
    }

    noResults?.classList.add('hidden');

    // Paginate
    const start = (currentPage - 1) * POSTS_PER_PAGE;
    const paginated = filtered.slice(start, start + POSTS_PER_PAGE);

    grid.innerHTML = paginated.map(renderPostCard).join('');
    renderPagination(filtered.length, currentPage);
}

async function initListingPage() {
    const posts = await fetchPosts();
    if (!posts.length) return;

    // Sort by date (newest first)
    posts.sort((a, b) => new Date(b.date) - new Date(a.date));

    window._blogAllPosts = posts;
    window._blogCurrentCategory = 'all';
    window._blogCurrentPage = 1;

    renderCategoryFilter(posts);
    renderPostsPage(posts);
}

// ================================
// POST PAGE
// ================================
async function initPostPage() {
    const slug = getSlugFromURL();
    const posts = await fetchPosts();

    if (!posts.length) {
        renderPostNotFound();
        return;
    }

    const postMeta = posts.find(p => p.slug === slug);
    if (!postMeta) {
        renderPostNotFound();
        return;
    }

    // Buscar conteúdo completo do post individual
    let post = postMeta;
    try {
        const postPath = `/blog/posts/${slug}.json`;
        const resp = await fetch(postPath);
        if (resp.ok) {
            const fullPost = await resp.json();
            post = { ...postMeta, ...fullPost };
        }
    } catch (e) {
        console.warn('Could not fetch full post content, using metadata only');
    }

    // Fallback: autor e readTime
    if (!post.author) post.author = 'Equipe Almeida & Matos';
    if (!post.readTime) {
        const wordCount = (post.content || '').replace(/<[^>]+>/g, '').split(/\s+/).length;
        post.readTime = Math.max(1, Math.ceil(wordCount / 200)) + ' min';
    }

    // Update page meta
    document.getElementById('page-title').textContent = `${post.title} | Almeida & Matos Advogados`;
    document.getElementById('page-description')?.setAttribute('content', post.excerpt);
    document.getElementById('page-canonical')?.setAttribute('href', `${SITE_URL}/${post.slug}/`);
    document.getElementById('og-title')?.setAttribute('content', post.title);
    document.getElementById('og-description')?.setAttribute('content', post.excerpt);
    document.getElementById('og-url')?.setAttribute('content', `${SITE_URL}/${post.slug}/`);

    // Breadcrumb
    const breadcrumbTitle = document.getElementById('breadcrumb-title');
    if (breadcrumbTitle) breadcrumbTitle.textContent = post.title;

    // Category
    const categoryEl = document.getElementById('post-category');
    if (categoryEl) categoryEl.textContent = post.category;

    // Title
    const titleEl = document.getElementById('post-title');
    if (titleEl) titleEl.textContent = post.title;

    // Meta
    const metaEl = document.getElementById('post-meta');
    if (metaEl) {
        metaEl.innerHTML = `
            <div class="post-meta-item">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                ${formatDate(post.date)}
            </div>
            <div class="post-meta-item">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                ${post.readTime} de leitura
            </div>
            <div class="post-meta-item">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                ${post.author}
            </div>
        `;
    }

    // Content
    const contentEl = document.getElementById('post-content');
    if (contentEl) contentEl.innerHTML = post.content;

    // Related posts
    renderRelatedPosts(posts, post);

    // Schema.org structured data
    injectStructuredData(post);
}

function renderRelatedPosts(posts, currentPost) {
    const container = document.getElementById('related-posts');
    const list = document.getElementById('related-posts-list');
    if (!container || !list) return;

    // Find related by same category, excluding current
    let related = posts
        .filter(p => p.id !== currentPost.id && p.categorySlug === currentPost.categorySlug)
        .slice(0, 3);

    // If not enough, fill with recent posts
    if (related.length < 3) {
        const more = posts
            .filter(p => p.id !== currentPost.id && !related.find(r => r.id === p.id))
            .slice(0, 3 - related.length);
        related = [...related, ...more];
    }

    if (related.length === 0) return;

    container.classList.remove('hidden');

    list.innerHTML = related.map(post => `
        <a href="/${post.slug}/" class="block p-3 rounded-lg border border-navy-100 hover:border-gold-400/30 transition-all hover:bg-white/50">
            <span class="text-xs text-gold-600 font-semibold uppercase">${post.category}</span>
            <h4 class="text-sm font-semibold text-navy-950 mt-1 leading-snug">${post.title}</h4>
            <span class="text-xs text-navy-400 mt-1 block">${formatDate(post.date)}</span>
        </a>
    `).join('');
}

function renderPostNotFound() {
    document.getElementById('page-title').textContent = 'Artigo não encontrado | Almeida & Matos';
    const titleEl = document.getElementById('post-title');
    if (titleEl) titleEl.textContent = 'Artigo não encontrado';
    const categoryEl = document.getElementById('post-category');
    if (categoryEl) categoryEl.style.display = 'none';
    const metaEl = document.getElementById('post-meta');
    if (metaEl) metaEl.innerHTML = '';
    const contentEl = document.getElementById('post-content');
    if (contentEl) {
        contentEl.innerHTML = `
            <div class="text-center py-12">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-16 h-16 mx-auto mb-4 text-navy-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p class="text-lg font-semibold text-navy-600 mb-2">Este artigo não foi encontrado</p>
                <p class="text-navy-400 mb-6">O artigo que você procura pode ter sido removido ou o link está incorreto.</p>
                <a href="/blog/" class="inline-flex items-center gap-2 px-5 py-2.5 bg-gold-500 text-white font-semibold rounded-full hover:bg-gold-600 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Voltar ao Blog
                </a>
            </div>
        `;
    }
    const breadcrumbTitle = document.getElementById('breadcrumb-title');
    if (breadcrumbTitle) breadcrumbTitle.textContent = 'Não encontrado';
}

function injectStructuredData(post) {
    const schema = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        'headline': post.title,
        'description': post.excerpt,
        'datePublished': post.date,
        'author': {
            '@type': 'Organization',
            'name': 'Almeida & Matos Advogados',
            'url': SITE_URL,
        },
        'publisher': {
            '@type': 'Organization',
            'name': 'Almeida & Matos Advogados',
            'url': SITE_URL,
        },
        'mainEntityOfPage': {
            '@type': 'WebPage',
            '@id': `${SITE_URL}/${post.slug}/`,
        },
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
}

// ================================
// SHARED: Navbar scroll + mobile menu
// ================================
function initNavbar() {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('navbar-scrolled');
        } else {
            navbar.classList.remove('navbar-scrolled');
        }
    }, { passive: true });
}

function initMobileMenu() {
    const toggle = document.getElementById('menu-toggle');
    const mobileNav = document.getElementById('mobile-nav');
    if (!toggle || !mobileNav) return;

    let menuOpen = false;

    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        menuOpen = !menuOpen;
        mobileNav.classList.toggle('open', menuOpen);
        toggle.classList.toggle('open', menuOpen);
    });

    mobileNav.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            menuOpen = false;
            mobileNav.classList.remove('open');
            toggle.classList.remove('open');
        });
    });

    document.addEventListener('click', (e) => {
        if (menuOpen && !mobileNav.contains(e.target) && !toggle.contains(e.target)) {
            menuOpen = false;
            mobileNav.classList.remove('open');
            toggle.classList.remove('open');
        }
    });
}

// ================================
// INIT
// ================================
document.addEventListener('DOMContentLoaded', () => {
    initNavbar();
    initMobileMenu();

    if (isPostPage()) {
        initPostPage();
    } else {
        initListingPage();
    }
});
