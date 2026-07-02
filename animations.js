import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Motor de animação v2 — data-attribute driven.
 * Gramática da marca: retas, diagonais e triângulos.
 * Easing sóbrio (power3/power4), sem bounce.
 *
 * Atributos:
 *  data-reveal / data-reveal-title  → fade+slide on-scroll
 *  data-card                        → stagger agrupado por container-pai
 *  data-counter="N"                 → count-up (data-counter-format="pt" p/ milhar)
 *  data-parallax="0.3"              → parallax vertical (scrub)
 *  data-img-parallax                → parallax interno de imagem em <figure>
 *  data-clip-reveal                 → abertura diagonal via clip-path
 *  data-rule                        → filete que cresce (scaleX)
 *  data-magnetic                    → botão magnético (desktop)
 */
export function initAnimations({ prefersReduced, isTouch } = {}) {
    try {
        initAnimationsInner({ prefersReduced, isTouch });
    } catch (err) {
        // Safety-net: se o motor falhar por qualquer motivo, nenhum conteúdo
        // pode ficar preso invisível nos estados iniciais de reveal.
        console.error('[animations] falha no init — revelando conteúdo:', err);
        revealEverything();
    }
}

function revealEverything() {
    document.querySelectorAll('[data-reveal], [data-reveal-title], [data-card], [data-hero-fade], [data-hero-visual]')
        .forEach((el) => { el.style.opacity = 1; el.style.transform = 'none'; });
    document.querySelectorAll('[data-hero-line], .hero__line > span')
        .forEach((el) => { el.style.transform = 'none'; });
    document.querySelectorAll('[data-clip-reveal]').forEach((el) => { el.style.clipPath = 'none'; });
    document.querySelectorAll('[data-rule]').forEach((el) => { el.style.transform = 'none'; });
    // contadores não podem ficar travados no "0" inicial
    document.querySelectorAll('[data-counter]').forEach(setCounterFinal);
}

function initAnimationsInner({ prefersReduced, isTouch } = {}) {
    if (prefersReduced === undefined) {
        prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    if (isTouch === undefined) {
        isTouch = window.matchMedia('(hover: none)').matches;
    }

    // Sem motion: tudo visível, nada de triggers
    if (prefersReduced) {
        document.querySelectorAll('[data-reveal], [data-reveal-title], [data-card], [data-clip-reveal], [data-rule]')
            .forEach((el) => { el.style.opacity = 1; el.style.transform = 'none'; el.style.clipPath = 'none'; });
        document.querySelectorAll('[data-counter]').forEach(setCounterFinal);
        const steps = document.getElementById('stepsPath');
        if (steps) steps.style.strokeDashoffset = 0;
        const ppath = document.getElementById('processPath');
        if (ppath) ppath.style.strokeDashoffset = 0;
        document.querySelectorAll('[data-process-step]').forEach((s) => s.classList.add('is-active'));
        document.querySelectorAll('[data-draw] path').forEach((p) => { p.style.strokeDashoffset = 0; });
        return;
    }

    // ---- Reveals genéricos ----
    document.querySelectorAll('[data-reveal], [data-reveal-title]').forEach((el) => {
        gsap.to(el, {
            opacity: 1, y: 0,
            duration: el.hasAttribute('data-reveal-title') ? 1.05 : 0.8,
            ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 86%' },
        });
    });

    // ---- Cards: stagger agrupado por container-pai ----
    const groups = new Map();
    document.querySelectorAll('[data-card]').forEach((el) => {
        const parent = el.parentElement;
        if (!groups.has(parent)) groups.set(parent, []);
        groups.get(parent).push(el);
    });
    groups.forEach((els, parent) => {
        gsap.to(els, {
            opacity: 1, y: 0, duration: 0.75, stagger: 0.09, ease: 'power3.out',
            scrollTrigger: { trigger: parent, start: 'top 84%' },
        });
    });

    // ---- Contadores ----
    document.querySelectorAll('[data-counter]').forEach((el) => {
        const target = parseFloat(el.dataset.counter || '0');
        const obj = { v: 0 };
        ScrollTrigger.create({
            trigger: el, start: 'top 85%', once: true,
            onEnter: () => {
                gsap.to(obj, {
                    v: target, duration: 1.8, ease: 'power2.out',
                    onUpdate: () => { el.textContent = formatCounter(Math.round(obj.v), el.dataset.counterFormat); },
                    onComplete: () => setCounterFinal(el),
                });
            },
        });
    });

    // ---- Parallax de grafismos (marca d'água triangular) ----
    document.querySelectorAll('[data-parallax]').forEach((el) => {
        const speed = parseFloat(el.dataset.parallax || '0.3');
        gsap.to(el, {
            yPercent: -50 * speed * 2, ease: 'none',
            scrollTrigger: {
                trigger: el.closest('section') || el,
                start: 'top bottom', end: 'bottom top', scrub: 0.6,
            },
        });
    });

    // ---- Parallax interno de imagens ----
    document.querySelectorAll('[data-img-parallax] img').forEach((img) => {
        gsap.fromTo(img, { yPercent: -6 }, {
            yPercent: 6, ease: 'none',
            scrollTrigger: {
                trigger: img.closest('figure'),
                start: 'top bottom', end: 'bottom top', scrub: 0.5,
            },
        });
    });

    // ---- Clip reveal diagonal (imagens institucionais) ----
    document.querySelectorAll('[data-clip-reveal]').forEach((el) => {
        gsap.to(el, {
            clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)',
            duration: 1.1, ease: 'power4.inOut',
            scrollTrigger: { trigger: el, start: 'top 82%' },
        });
    });

    // ---- Filetes que crescem ----
    document.querySelectorAll('[data-rule]').forEach((el) => {
        gsap.to(el, {
            scaleX: 1, duration: 0.9, ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 88%' },
        });
    });

    // ---- Linha do processo (SVG draw sincronizado com o scroll) ----
    const stepsPath = document.getElementById('stepsPath');
    if (stepsPath) {
        const len = stepsPath.getTotalLength();
        stepsPath.style.strokeDasharray = len;
        stepsPath.style.strokeDashoffset = len;
        gsap.to(stepsPath, {
            strokeDashoffset: 0, ease: 'none',
            scrollTrigger: {
                trigger: stepsPath.closest('.steps'),
                start: 'top 78%', end: 'bottom 55%', scrub: 0.6,
            },
        });
    }

    // ---- Timeline do processo: linha completa e etapas acendem no scroll ----
    const processPath = document.getElementById('processPath');
    if (processPath) {
        const track = processPath.closest('.process__track');
        const plen = processPath.getTotalLength();
        processPath.style.strokeDasharray = plen;
        processPath.style.strokeDashoffset = plen;
        gsap.to(processPath, {
            strokeDashoffset: 0, ease: 'none',
            scrollTrigger: { trigger: track, start: 'top 62%', end: 'bottom 68%', scrub: 0.5 },
        });
        document.querySelectorAll('[data-process-step]').forEach((step) => {
            ScrollTrigger.create({
                trigger: step, start: 'top 66%',
                onEnter: () => step.classList.add('is-active'),
                onLeaveBack: () => step.classList.remove('is-active'),
            });
        });
    }

    // ---- Símbolo A&M se montando no scroll (data-draw) ----
    document.querySelectorAll('[data-draw]').forEach((svg) => {
        const paths = svg.querySelectorAll('path');
        paths.forEach((p) => {
            const l = p.getTotalLength();
            p.style.strokeDasharray = l;
            p.style.strokeDashoffset = l;
        });
        gsap.to(paths, {
            strokeDashoffset: 0, ease: 'none', stagger: 0.12,
            scrollTrigger: {
                trigger: svg.closest('section') || svg,
                start: 'top 82%', end: 'bottom 95%', scrub: 0.6,
            },
        });
    });

    // ---- Botões magnéticos (desktop apenas) ----
    if (!isTouch) {
        document.querySelectorAll('[data-magnetic]').forEach((btn) => {
            btn.addEventListener('mousemove', (e) => {
                const r = btn.getBoundingClientRect();
                const x = e.clientX - r.left - r.width / 2;
                const y = e.clientY - r.top - r.height / 2;
                gsap.to(btn, { x: x * 0.18, y: y * 0.24, duration: 0.4, ease: 'power2.out' });
            });
            btn.addEventListener('mouseleave', () => {
                gsap.to(btn, { x: 0, y: 0, duration: 0.5, ease: 'power3.out' });
            });
        });
    }
}

function formatCounter(n, format) {
    if (format === 'pt') return n.toLocaleString('pt-BR');
    return String(n);
}

function setCounterFinal(el) {
    el.textContent = formatCounter(parseFloat(el.dataset.counter || '0'), el.dataset.counterFormat);
}

// Alias legado — blog.js antigo importava initAnimations sem args
export default initAnimations;
