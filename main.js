import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { initAnimations } from './animations.js';

gsap.registerPlugin(ScrollTrigger);

// ================================
// 1. Smooth Scroll (Lenis)
// ================================
const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    direction: 'vertical',
    gestureDirection: 'vertical',
    smooth: true,
    smoothTouch: false,
    touchMultiplier: 2,
});

lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
});
gsap.ticker.lagSmoothing(0, 0);

// ================================
// 2. Page Load — dispatch loaderComplete
// ================================
document.addEventListener('DOMContentLoaded', () => {
    initNavbar();
    initFaqAccordion();
    initSmoothAnchors();
    initMobileMenu();
    initAnimations();

    // Fire after initAnimations so the loaderComplete listener is ready
    document.dispatchEvent(new CustomEvent('loaderComplete'));

    setTimeout(() => {
        ScrollTrigger.refresh();
    }, 200);
});

// ================================
// 3. Navbar Scroll Effect
// ================================
function initNavbar() {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;

    ScrollTrigger.create({
        start: 'top -50px',
        end: 99999,
        onUpdate: () => {
            if (window.scrollY > 50) {
                navbar.classList.add('navbar-scrolled');
            } else {
                navbar.classList.remove('navbar-scrolled');
            }
        }
    });
}

// ================================
// 4. FAQ Accordion
// ================================
function initFaqAccordion() {
    const faqButtons = document.querySelectorAll('.faq-question');

    faqButtons.forEach(button => {
        button.addEventListener('click', () => {
            const faqContent = button.nextElementSibling;
            const icon = button.querySelector('.faq-icon');
            const item = button.closest('.faq-item');

            if (item.classList.contains('active')) {
                // Close this one
                faqContent.style.maxHeight = null;
                if (icon) icon.style.transform = 'rotate(0deg)';
                item.classList.remove('active');
            } else {
                // Close all others
                document.querySelectorAll('.faq-item').forEach(otherItem => {
                    otherItem.classList.remove('active');
                    const otherContent = otherItem.querySelector('.faq-answer');
                    const otherIcon = otherItem.querySelector('.faq-icon');
                    if (otherContent) otherContent.style.maxHeight = null;
                    if (otherIcon) otherIcon.style.transform = 'rotate(0deg)';
                });

                // Open clicked
                faqContent.style.maxHeight = faqContent.scrollHeight + 'px';
                if (icon) icon.style.transform = 'rotate(45deg)';
                item.classList.add('active');
            }

            setTimeout(() => ScrollTrigger.refresh(), 400);
        });
    });
}

// ================================
// 5. Smooth Scroll for Anchor Links
// ================================
function initSmoothAnchors() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', (e) => {
            const href = anchor.getAttribute('href');
            if (href === '#') return;
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                lenis.scrollTo(target, { offset: -80 });
                // Close mobile menu if open
                closeMobileMenu();
            }
        });
    });
}

// ================================
// 6. Mobile Menu
// ================================
let menuOpen = false;

function initMobileMenu() {
    const toggle = document.getElementById('menu-toggle');
    const mobileNav = document.getElementById('mobile-nav');
    if (!toggle || !mobileNav) return;

    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (menuOpen) {
            closeMobileMenu();
        } else {
            openMobileMenu();
        }
    });

    // Close on link click inside mobile nav
    mobileNav.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            closeMobileMenu();
        });
    });

    // Close on clicking outside
    document.addEventListener('click', (e) => {
        if (menuOpen && !mobileNav.contains(e.target) && !toggle.contains(e.target)) {
            closeMobileMenu();
        }
    });
}

function openMobileMenu() {
    const mobileNav = document.getElementById('mobile-nav');
    const toggle = document.getElementById('menu-toggle');
    if (!mobileNav) return;
    menuOpen = true;
    mobileNav.classList.add('open');
    if (toggle) toggle.classList.add('open');
    lenis.stop();
}

function closeMobileMenu() {
    const mobileNav = document.getElementById('mobile-nav');
    const toggle = document.getElementById('menu-toggle');
    if (!mobileNav) return;
    menuOpen = false;
    mobileNav.classList.remove('open');
    if (toggle) toggle.classList.remove('open');
    lenis.start();
}

// ================================
// Blog Preview (Homepage)
// ================================
async function loadBlogPreview() {
    const container = document.getElementById('homepage-blog-posts');
    if (!container) return;

    try {
        const resp = await fetch('/blog/posts/posts-data.json');
        if (!resp.ok) return;
        const posts = await resp.json();

        // Pegar os 3 mais recentes
        posts.sort((a, b) => new Date(b.date) - new Date(a.date));
        const recent = posts.slice(0, 3);

        container.innerHTML = recent.map(post => {
            const date = new Date(post.date + 'T12:00:00');
            const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

            return `
                <a href="/${post.slug}/" class="block rounded-2xl overflow-hidden hover:shadow-lg transition-all group" style="background:#fff;border:1px solid #E2E0DA;">
                    <div class="p-5">
                        <span style="color:#1B365D;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">${post.category}</span>
                        <h3 class="font-serif group-hover:text-gold-600 transition-colors" style="color:#0A1628;font-size:1.05rem;font-weight:700;margin:0.5rem 0;line-height:1.3">${post.title}</h3>
                        <p style="color:#5A6577;font-size:0.85rem;line-height:1.5">${post.excerpt?.substring(0, 120)}...</p>
                        <div style="color:#8B95A5;font-size:0.75rem;margin-top:1rem;display:flex;align-items:center;gap:0.5rem">
                            <span>${dateStr}</span>
                            <span>·</span>
                            <span>${post.readTime || '5 min'} de leitura</span>
                        </div>
                    </div>
                </a>
            `;
        }).join('');
    } catch (e) {
        console.warn('Blog preview not available:', e);
    }
}

// Inicializar quando DOM estiver pronto
if (document.getElementById('homepage-blog-posts')) {
    loadBlogPreview();
}
