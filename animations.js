import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

let countersHaveRun = false;

function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function runCounters() {
    if (countersHaveRun) return;
    countersHaveRun = true;

    const counters = document.querySelectorAll('.counter-number');
    counters.forEach(counter => {
        const target = +counter.getAttribute('data-target');
        const duration = 2000;
        const start = target > 100 ? 2000 : 0;

        if (prefersReducedMotion()) {
            counter.innerText = target;
            return;
        }

        let startTime = null;

        function animate(currentTime) {
            if (startTime === null) startTime = currentTime;
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // easeOutSine
            const eased = Math.sin(progress * Math.PI / 2);

            counter.innerText = Math.floor(start + eased * (target - start));

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                counter.innerText = target;
            }
        }
        requestAnimationFrame(animate);
    });
}

export function initAnimations() {
    const reduced = prefersReducedMotion();

    ScrollTrigger.defaults({
        toggleActions: 'play none none none',
    });

    // If reduced motion, make everything visible immediately
    if (reduced) {
        gsap.set('.hero-reveal, .section-title, .reveal-card, .reveal-left, .reveal-right, .step-card, .testimonial-card, .faq-item, .cta-reveal, .identify-item, .counter-item', {
            opacity: 1,
            x: 0,
            y: 0,
            scale: 1,
            clearProps: 'all',
        });
        runCounters();
        return;
    }

    // ================================
    // HERO - triggered after loader
    // ================================
    gsap.set('.hero-reveal', { opacity: 0, y: 40 });

    document.addEventListener('loaderComplete', () => {
        gsap.to('.hero-reveal', {
            opacity: 1,
            y: 0,
            duration: 0.8,
            stagger: 0.15,
            ease: 'power2.out',
            clearProps: 'transform',
        });
    });

    // ================================
    // CREDIBILITY BAR - counters
    // ================================
    gsap.set('.counter-item', { opacity: 0, y: 20 });

    ScrollTrigger.create({
        trigger: '#credibilidade',
        start: 'top 85%',
        onEnter: () => {
            gsap.to('.counter-item', {
                opacity: 1,
                y: 0,
                duration: 0.6,
                stagger: 0.12,
                ease: 'power2.out',
                onComplete: runCounters,
            });
        },
        once: true,
    });

    // ================================
    // SECTION TITLES
    // ================================
    gsap.utils.toArray('.section-title').forEach(title => {
        gsap.fromTo(title,
            { opacity: 0, y: 25 },
            {
                scrollTrigger: {
                    trigger: title,
                    start: 'top 85%',
                },
                opacity: 1,
                y: 0,
                duration: 0.7,
                ease: 'power3.out',
            }
        );
    });

    // ================================
    // IDENTIFY ITEMS (scale-in)
    // ================================
    gsap.utils.toArray('.identify-item').forEach((item, i) => {
        gsap.fromTo(item,
            { opacity: 0, scale: 0.8 },
            {
                scrollTrigger: {
                    trigger: item.closest('section') || item,
                    start: 'top 85%',
                },
                opacity: 1,
                scale: 1,
                duration: 0.5,
                delay: i * 0.08,
                ease: 'back.out(1.4)',
            }
        );
    });

    // ================================
    // CARD REVEALS (staggered)
    // ================================
    gsap.utils.toArray('.reveal-card').forEach((card, i) => {
        gsap.fromTo(card,
            { opacity: 0, y: 30 },
            {
                scrollTrigger: {
                    trigger: card.closest('.grid') || card.closest('section') || card,
                    start: 'top 85%',
                },
                opacity: 1,
                y: 0,
                duration: 0.6,
                delay: i * 0.12,
                ease: 'power2.out',
            }
        );
    });

    // ================================
    // LEFT REVEALS
    // ================================
    gsap.utils.toArray('.reveal-left').forEach(el => {
        gsap.fromTo(el,
            { opacity: 0, x: -60 },
            {
                scrollTrigger: {
                    trigger: el,
                    start: 'top 85%',
                },
                opacity: 1,
                x: 0,
                duration: 0.8,
                ease: 'power3.out',
            }
        );
    });

    // ================================
    // RIGHT REVEALS
    // ================================
    gsap.utils.toArray('.reveal-right').forEach(el => {
        gsap.fromTo(el,
            { opacity: 0, x: 60 },
            {
                scrollTrigger: {
                    trigger: el,
                    start: 'top 85%',
                },
                opacity: 1,
                x: 0,
                duration: 0.8,
                ease: 'power3.out',
            }
        );
    });

    // ================================
    // STEP CARDS
    // ================================
    gsap.utils.toArray('.step-card').forEach((card, i) => {
        gsap.fromTo(card,
            { opacity: 0, y: 30 },
            {
                scrollTrigger: {
                    trigger: '#como-funciona',
                    start: 'top 85%',
                },
                opacity: 1,
                y: 0,
                duration: 0.6,
                delay: i * 0.12,
                ease: 'power2.out',
            }
        );
    });

    // ================================
    // TESTIMONIAL CARDS
    // ================================
    gsap.utils.toArray('.testimonial-card').forEach((card, i) => {
        gsap.fromTo(card,
            { opacity: 0, y: 25 },
            {
                scrollTrigger: {
                    trigger: '#depoimentos',
                    start: 'top 85%',
                },
                opacity: 1,
                y: 0,
                duration: 0.6,
                delay: i * 0.1,
                ease: 'power2.out',
            }
        );
    });

    // ================================
    // FAQ ITEMS
    // ================================
    gsap.utils.toArray('.faq-item').forEach((item, i) => {
        gsap.fromTo(item,
            { opacity: 0, y: 15 },
            {
                scrollTrigger: {
                    trigger: '#faq',
                    start: 'top 85%',
                },
                opacity: 1,
                y: 0,
                duration: 0.5,
                delay: i * 0.08,
                ease: 'power2.out',
            }
        );
    });

    // ================================
    // CTA FINAL
    // ================================
    gsap.utils.toArray('.cta-reveal').forEach((el, i) => {
        gsap.fromTo(el,
            { opacity: 0, y: 25 },
            {
                scrollTrigger: {
                    trigger: '#contato',
                    start: 'top 85%',
                },
                opacity: 1,
                y: 0,
                duration: 0.7,
                delay: i * 0.12,
                ease: 'power2.out',
            }
        );
    });
}
