import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { initAnimations } from './animations.js';
import { initGlobe } from './globe.js';

gsap.registerPlugin(ScrollTrigger);

document.documentElement.classList.add('js');

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = window.matchMedia('(hover: none)').matches;

// ================================
// 1. Smooth Scroll (Lenis) — ticker único do GSAP
// ================================
let lenis = null;
if (!prefersReduced) {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
}

// ================================
// 2. Preloader (toda visita, ≤2s no pior caso)
// ================================
const preloader = document.getElementById('preloader');

function heroIntro() {
    if (prefersReduced) return;
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.to('[data-hero-line] , .hero__line > span', { y: 0, duration: 1.0, stagger: 0.1 }, 0.05)
      .to('[data-hero-fade]', { opacity: 1, y: 0, duration: 0.8, stagger: 0.08 }, 0.4)
      .to('[data-hero-visual]', { opacity: 1, y: 0, scale: 1, duration: 1.1, ease: 'power2.out' }, 0.3);
}

function hidePreloader() {
    if (!preloader || preloader.dataset.done) return;
    preloader.dataset.done = '1';
    if (prefersReduced) { preloader.remove(); return; }
    gsap.timeline()
        .to('.preloader__bar span', { width: '100%', duration: 0.3, ease: 'power1.inOut' })
        .to(preloader, {
            // sai com wipe diagonal (gramática da marca)
            clipPath: 'polygon(0 0, 100% 0, 100% 0, 0 0)',
            duration: 0.65, ease: 'power4.inOut',
            onComplete: () => { preloader.remove(); ScrollTrigger.refresh(); },
        }, '+=0.04');
    heroIntro();
}

if (preloader) {
    if (prefersReduced) {
        preloader.remove();
        revealAllInstant();
    } else {
        // 1) contornos do símbolo se desenham; 2) as cores do logo preenchem
        const lines = preloader.querySelectorAll('.preloader__mark .mk-line');
        lines.forEach((p, i) => {
            const len = p.getTotalLength();
            p.style.strokeDasharray = len;
            p.style.strokeDashoffset = len;
            gsap.to(p, { strokeDashoffset: 0, duration: 0.7, delay: i * 0.06, ease: 'power2.inOut' });
        });
        gsap.to(preloader.querySelectorAll('.preloader__mark .mk-fill'), {
            opacity: 1, duration: 0.35, delay: 0.62, stagger: 0.05, ease: 'power1.in',
        });
        gsap.to(lines, { opacity: 0, duration: 0.3, delay: 0.85 });
        gsap.set(preloader, { clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' });
        gsap.to('.preloader__bar span', { width: '78%', duration: 0.5, ease: 'power2.out' });
        window.addEventListener('load', hidePreloader);
        setTimeout(hidePreloader, 1000); // teto: com a saída (~1s), fica ≤2s sempre
    }
} else {
    heroIntro();
}

function revealAllInstant() {
    document.querySelectorAll('[data-hero-fade], [data-hero-visual]').forEach((el) => {
        el.style.opacity = 1; el.style.transform = 'none';
    });
    document.querySelectorAll('[data-hero-line], .hero__line > span').forEach((el) => {
        el.style.transform = 'none';
    });
}

// ================================
// 3. Navbar — esconde ao descer, mostra ao subir
// ================================
const nav = document.getElementById('nav');
let lastY = 0;
function onScrollNav() {
    const y = window.scrollY;
    nav.classList.toggle('is-scrolled', y > 50);
    nav.classList.toggle('is-hidden',
        y > 480 && y > lastY && !document.body.classList.contains('menu-open'));
    lastY = y;
}
if (nav) {
    window.addEventListener('scroll', onScrollNav, { passive: true });
    onScrollNav();
}

// ================================
// 4. Menu mobile
// ================================
const burger = document.getElementById('navBurger');
const mobileMenu = document.getElementById('mobileMenu');
function closeMenu() {
    document.body.classList.remove('menu-open');
    burger?.setAttribute('aria-expanded', 'false');
    mobileMenu?.setAttribute('aria-hidden', 'true');
    if (lenis) lenis.start();
}
if (burger && mobileMenu) {
    burger.addEventListener('click', () => {
        const open = document.body.classList.toggle('menu-open');
        burger.setAttribute('aria-expanded', String(open));
        mobileMenu.setAttribute('aria-hidden', String(!open));
        if (lenis) open ? lenis.stop() : lenis.start();
    });
    mobileMenu.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeMenu));
}

// ================================
// 5. Âncoras suaves via Lenis
// ================================
document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        const target = id.length > 1 && document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        closeMenu();
        if (lenis) lenis.scrollTo(target, { offset: -70, duration: 1.3 });
        else target.scrollIntoView({ behavior: 'smooth' });
    });
});

// ================================
// 6. FAQ accordion (details animado)
// ================================
document.querySelectorAll('.faq__item').forEach((item) => {
    const summary = item.querySelector('summary');
    const answer = item.querySelector('.faq__answer');
    if (!summary || !answer) return;
    summary.addEventListener('click', (e) => {
        if (prefersReduced) return; // comportamento nativo
        e.preventDefault();
        if (item.open) {
            gsap.to(answer, {
                height: 0, opacity: 0, duration: 0.32, ease: 'power2.inOut',
                onComplete: () => { item.open = false; answer.style.height = ''; },
            });
        } else {
            item.open = true;
            gsap.fromTo(answer, { height: 0, opacity: 0 }, {
                height: 'auto', opacity: 1, duration: 0.42, ease: 'power2.out',
                onComplete: () => { answer.style.height = ''; },
            });
        }
    });
});

// ================================
// 7. Blog preview — posts estáticos + posts novos (Supabase via API)
// ================================
const blogGrid = document.getElementById('blogPreviewGrid');
if (blogGrid) {
    // posts-preview.json (12 posts, gerado no build) evita baixar os ~257KB
    // do posts-data.json completo só pra montar 3 cards na home.
    const staticPosts = fetch('/blog/posts/posts-preview.json')
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('preview indisponível'))))
        .catch(() => fetch('/blog/posts/posts-data.json').then((r) => r.json()).catch(() => []));
    const apiPosts = fetch('/api/blog/list?limit=3').then((r) => (r.ok ? r.json() : [])).catch(() => []);

    Promise.all([staticPosts, apiPosts]).then(([a, b]) => {
        const seen = new Set();
        const posts = [...(Array.isArray(b) ? b : []), ...(Array.isArray(a) ? a : [])]
            .filter((p) => p && p.slug && !seen.has(p.slug) && seen.add(p.slug))
            .sort((x, y) => (y.date || '').localeCompare(x.date || ''))
            .slice(0, 3);

        blogGrid.innerHTML = posts.map((p) => `
            <a class="card post-card" href="/${p.slug}/">
                <span class="post-card__tag">${esc(p.category || 'Direitos')}</span>
                <h3>${esc(p.title)}</h3>
                <p style="font-size:0.92rem">${esc((p.excerpt || '').slice(0, 140))}${(p.excerpt || '').length > 140 ? '…' : ''}</p>
                <span class="post-card__meta">${formatDate(p.date)} · ${esc(p.readTime || '5 min')}</span>
            </a>`).join('');

        if (!prefersReduced && blogGrid.children.length) {
            gsap.from(blogGrid.children, {
                opacity: 0, y: 30, stagger: 0.1, duration: 0.7, ease: 'power3.out',
                scrollTrigger: { trigger: blogGrid, start: 'top 86%' },
            });
        }
    }).catch(() => { blogGrid.closest('section')?.remove(); });
}

function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function formatDate(iso) {
    if (!iso) return '';
    try {
        return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return iso; }
}

// ================================
// 8. Tracking WhatsApp (GTM dataLayer) — mantido da v1
// ================================
window.dataLayer = window.dataLayer || [];
document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href*="wa.me"]');
    if (!link) return;
    let location = 'page';
    if (link.closest('#whatsFab')) location = 'float';
    else if (link.closest('.nav')) location = 'navbar';
    else if (link.closest('.hero')) location = 'hero';
    else if (link.closest('.footer')) location = 'footer';
    else if (link.closest('.mobile-menu')) location = 'mobile_menu';
    else if (link.closest('.cta-final')) location = 'page_cta';
    window.dataLayer.push({
        event: 'click_whatsapp',
        click_location: location,
        page_path: window.location.pathname,
        page_title: document.title,
    });
});

// ================================
// 9. Animações on-scroll + globo 3D do Brasil
// ================================
initAnimations({ prefersReduced, isTouch });
try { initGlobe({ prefersReduced }); } catch (e) { console.error('[globe]', e); }
