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
