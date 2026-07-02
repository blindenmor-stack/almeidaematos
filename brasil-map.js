import gsap from 'gsap';

/**
 * Mapa do Brasil animado (canvas 2D) — inspirado no globo do Stripe.
 * O país desenhado em dot-matrix; arcos de luz partem de São Paulo em direção
 * às capitais, com pulso viajante e badge com o nome da cidade na chegada.
 * "Atendemos o Brasil inteiro, 100% online."
 *
 * Leve por construção: um único canvas, um único loop (gsap.ticker),
 * pausado fora do viewport, estático com prefers-reduced-motion.
 */

// Contorno simplificado do Brasil — pares [lat, lon], sentido horário.
const BR_OUTLINE = [
    [4.4, -51.6], [3.8, -51.2], [2.8, -50.7], [1.6, -50.3], [0.8, -50.0],
    [0.2, -49.2], [-0.6, -48.4], [-1.0, -46.8], [-1.6, -45.4], [-2.5, -44.3],
    [-2.8, -41.8], [-3.0, -39.9], [-3.7, -38.5], [-4.6, -37.2], [-5.1, -36.0],
    [-5.8, -35.2], [-7.1, -34.8], [-8.1, -34.9], [-9.7, -35.7], [-10.9, -37.0],
    [-12.2, -37.9], [-13.0, -38.5], [-14.5, -39.0], [-16.0, -39.0], [-17.5, -39.2],
    [-18.6, -39.7], [-20.3, -40.3], [-21.6, -41.0], [-23.0, -43.2], [-23.4, -44.8],
    [-24.1, -46.3], [-25.1, -47.9], [-25.9, -48.5], [-27.6, -48.5], [-28.7, -49.0],
    [-29.9, -50.1], [-31.4, -51.2], [-32.2, -52.2], [-33.7, -53.4],
    [-32.9, -54.5], [-31.9, -55.7], [-30.9, -56.0], [-30.2, -57.6],
    [-28.3, -55.8], [-27.3, -54.2], [-25.6, -54.6], [-24.1, -54.3],
    [-23.0, -54.2], [-22.5, -55.7], [-21.5, -57.9], [-20.0, -58.1],
    [-19.0, -57.7], [-17.6, -58.4], [-16.3, -60.2], [-15.1, -60.5],
    [-13.5, -61.0], [-12.4, -64.0], [-10.9, -65.3], [-9.8, -66.6],
    [-10.9, -69.6], [-9.4, -70.6], [-7.4, -73.8], [-6.6, -73.1],
    [-5.2, -71.9], [-4.2, -69.9], [-2.3, -69.9], [-0.3, -70.0],
    [1.1, -69.4], [1.2, -67.1], [2.1, -66.9], [3.6, -65.4], [4.2, -64.1],
    [5.2, -60.7], [4.4, -60.0], [2.8, -59.8], [1.4, -59.7], [1.2, -58.4],
    [2.0, -56.8], [2.3, -55.1], [2.5, -53.9], [2.3, -52.9], [3.8, -51.9],
];

// Capitais (destino dos arcos) — [nome, lat, lon]
const CAPITAIS = [
    ['Manaus', -3.1, -60.0], ['Belém', -1.45, -48.5], ['Boa Vista', 2.82, -60.7],
    ['Macapá', 0.04, -51.1], ['Porto Velho', -8.76, -63.9], ['Rio Branco', -9.97, -67.8],
    ['Palmas', -10.2, -48.3], ['São Luís', -2.53, -44.3], ['Teresina', -5.1, -42.8],
    ['Fortaleza', -3.7, -38.5], ['Natal', -5.8, -35.2], ['João Pessoa', -7.1, -34.9],
    ['Recife', -8.05, -34.9], ['Maceió', -9.6, -35.7], ['Aracaju', -10.9, -37.1],
    ['Salvador', -12.97, -38.5], ['Belo Horizonte', -19.9, -43.9], ['Vitória', -20.3, -40.3],
    ['Rio de Janeiro', -22.9, -43.2], ['Curitiba', -25.4, -49.3], ['Florianópolis', -27.6, -48.5],
    ['Porto Alegre', -30.03, -51.2], ['Brasília', -15.8, -47.9], ['Goiânia', -16.7, -49.3],
    ['Cuiabá', -15.6, -56.1], ['Campo Grande', -20.4, -54.6],
];

const SP = { name: 'São Paulo', lat: -23.55, lon: -46.63 };

// Bounds geográficos
const LAT_MAX = 5.6, LAT_MIN = -34.2, LON_MIN = -74.2, LON_MAX = -34.4;

// roundRect tem suporte recente (Safari 16+) — fallback manual evita
// quebrar o loop de render inteiro em navegadores mais antigos.
function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

const GOLD = '#D2AE6D';
const GOLD_SOFT = 'rgba(210, 174, 109, 0.85)';
const DOT = 'rgba(151, 163, 204, 0.4)';
const DOT_BRIGHT = 'rgba(194, 202, 223, 0.75)';

export function initBrasilMap({ prefersReduced } = {}) {
    const canvas = document.getElementById('brasilCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const wrap = canvas.parentElement;

    let W = 0, H = 0, DPR = 1;
    let dots = [];          // pontos do dot-matrix {x, y, r, tw (twinkle seed), gold}
    let project = null;     // (lat, lon) => {x, y}
    let flights = [];       // arcos em voo
    let arrivals = [];      // badges/bursts de chegada
    let lastLaunch = 0;
    let queue = [];         // fila embaralhada de capitais
    let running = false;
    let capPts = [];        // posições projetadas das capitais (interação)
    const mouse = { x: -9999, y: -9999, active: false };

    // ---- Geometria ----
    function buildProjection() {
        const pad = Math.max(18, W * 0.05);
        const availW = W - pad * 2, availH = H - pad * 2;
        const geoW = LON_MAX - LON_MIN, geoH = LAT_MAX - LAT_MIN;
        const scale = Math.min(availW / geoW, availH / geoH);
        const offX = (W - geoW * scale) / 2, offY = (H - geoH * scale) / 2;
        project = (lat, lon) => ({
            x: offX + (lon - LON_MIN) * scale,
            y: offY + (LAT_MAX - lat) * scale,
        });
    }

    function pointInBrasil(lat, lon) {
        // ray casting no polígono geográfico
        let inside = false;
        for (let i = 0, j = BR_OUTLINE.length - 1; i < BR_OUTLINE.length; j = i++) {
            const [lati, loni] = BR_OUTLINE[i];
            const [latj, lonj] = BR_OUTLINE[j];
            if ((loni > lon) !== (lonj > lon) &&
                lat < ((latj - lati) * (lon - loni)) / (lonj - loni) + lati) {
                inside = !inside;
            }
        }
        return inside;
    }

    function buildDots() {
        dots = [];
        const stepGeo = W < 560 ? 0.95 : 0.62; // graus entre pontos (menos denso no mobile)
        for (let lat = LAT_MIN; lat <= LAT_MAX; lat += stepGeo) {
            for (let lon = LON_MIN; lon <= LON_MAX; lon += stepGeo) {
                // jitter leve pra tirar a cara de grade perfeita
                const jLat = lat + (Math.random() - 0.5) * stepGeo * 0.35;
                const jLon = lon + (Math.random() - 0.5) * stepGeo * 0.35;
                if (!pointInBrasil(jLat, jLon)) continue;
                const { x, y } = project(jLat, jLon);
                dots.push({
                    x, y,
                    r: 1 + Math.random() * 0.9,
                    tw: Math.random() * Math.PI * 2,
                    gold: Math.random() < 0.05,
                });
            }
        }
    }

    function resize() {
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        W = wrap.clientWidth;
        H = Math.round(W * (W < 560 ? 1.0 : 0.92));
        canvas.width = W * DPR;
        canvas.height = H * DPR;
        canvas.style.height = `${H}px`;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        buildProjection();
        buildDots();
        capPts = CAPITAIS.map((c) => ({ name: c[0], ...project(c[1], c[2]) }));
        if (prefersReduced) drawStatic();
    }

    // ---- Voo (arcos) ----
    function nextCapital() {
        if (!queue.length) queue = [...CAPITAIS].sort(() => Math.random() - 0.5);
        return queue.pop();
    }

    function launch(now) {
        const cap = nextCapital();
        const from = project(SP.lat, SP.lon);
        const to = project(cap[1], cap[2]);
        const dist = Math.hypot(to.x - from.x, to.y - from.y);
        // ponto de controle perpendicular ao segmento (arco "levanta")
        const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2;
        const nx = -(to.y - from.y) / (dist || 1), ny = (to.x - from.x) / (dist || 1);
        const lift = Math.min(dist * 0.35, H * 0.16) * (to.x >= from.x ? 1 : -1);
        flights.push({
            name: cap[0], from, to,
            cx: mx + nx * lift, cy: my + ny * lift,
            t: 0, start: now,
            dur: 1400 + dist * 2.2,
        });
        lastLaunch = now;
    }

    function bezier(f, t) {
        const u = 1 - t;
        return {
            x: u * u * f.from.x + 2 * u * t * f.cx + t * t * f.to.x,
            y: u * u * f.from.y + 2 * u * t * f.cy + t * t * f.to.y,
        };
    }

    const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

    // ---- Desenho ----
    function drawBase(now) {
        ctx.clearRect(0, 0, W, H);
        const R_HOVER = 95;
        // dots do mapa (twinkle sutil + brilho dourado perto do cursor)
        for (const d of dots) {
            const tw = 0.75 + 0.25 * Math.sin(now / 1400 + d.tw);
            let near = 0;
            if (mouse.active) {
                const dist = Math.hypot(d.x - mouse.x, d.y - mouse.y);
                if (dist < R_HOVER) near = 1 - dist / R_HOVER;
            }
            ctx.globalAlpha = Math.min(1, tw + near * 0.6);
            if (near > 0.08) {
                ctx.fillStyle = `rgba(210, 174, 109, ${0.35 + near * 0.65})`;
                ctx.beginPath();
                ctx.arc(d.x, d.y, d.r + near * 1.6, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillStyle = d.gold ? GOLD_SOFT : (d.r > 1.5 ? DOT_BRIGHT : DOT);
                ctx.beginPath();
                ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;

        // capitais: marcador sutil sempre; badge quando o cursor se aproxima
        let hoverCap = null, hoverDist = 64;
        for (const c of capPts) {
            ctx.fillStyle = 'rgba(210, 174, 109, 0.5)';
            ctx.beginPath(); ctx.arc(c.x, c.y, 1.8, 0, Math.PI * 2); ctx.fill();
            if (mouse.active) {
                const dist = Math.hypot(c.x - mouse.x, c.y - mouse.y);
                if (dist < hoverDist) { hoverDist = dist; hoverCap = c; }
            }
        }
        if (hoverCap) {
            ctx.fillStyle = GOLD;
            ctx.shadowColor = GOLD; ctx.shadowBlur = 12;
            ctx.beginPath(); ctx.arc(hoverCap.x, hoverCap.y, 3.4, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
            drawBadge(hoverCap.x, hoverCap.y, hoverCap.name, 1);
        }

        // origem: São Paulo (pulso)
        const sp = project(SP.lat, SP.lon);
        const pulse = 4 + 2.4 * Math.sin(now / 380);
        ctx.fillStyle = 'rgba(210, 174, 109, 0.18)';
        ctx.beginPath(); ctx.arc(sp.x, sp.y, pulse + 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = GOLD;
        ctx.beginPath(); ctx.arc(sp.x, sp.y, 3.6, 0, Math.PI * 2); ctx.fill();
        drawBadge(sp.x, sp.y, 'São Paulo · HQ', 1, true);
    }

    function drawFlightPath(f, tHead, tTail, alpha) {
        ctx.strokeStyle = `rgba(210, 174, 109, ${0.55 * alpha})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        const steps = 34;
        let started = false;
        for (let i = 0; i <= steps; i++) {
            const tt = tTail + (tHead - tTail) * (i / steps);
            if (tt < 0 || tt > 1) continue;
            const p = bezier(f, tt);
            if (!started) { ctx.moveTo(p.x, p.y); started = true; }
            else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
    }

    function drawBadge(x, y, text, alpha, small = false) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.font = `600 ${small ? 10 : 11.5}px "Plus Jakarta Sans", sans-serif`;
        const wTxt = ctx.measureText(text).width;
        const padX = 8, h = small ? 20 : 24;
        let bx = x + 10, by = y - h - 8;
        if (bx + wTxt + padX * 2 > W - 6) bx = x - wTxt - padX * 2 - 10;
        if (by < 6) by = y + 10;
        ctx.fillStyle = 'rgba(13, 18, 38, 0.88)';
        ctx.strokeStyle = 'rgba(210, 174, 109, 0.45)';
        ctx.lineWidth = 1;
        rrect(ctx, bx, by, wTxt + padX * 2, h, 5);
        ctx.fill(); ctx.stroke();
        // triângulo da marca no badge
        ctx.fillStyle = GOLD;
        ctx.beginPath();
        ctx.moveTo(bx + padX - 2, by + h - 7);
        ctx.lineTo(bx + padX + 2, by + h - 7);
        ctx.lineTo(bx + padX, by + h - 11);
        ctx.closePath();
        // (triângulo decorativo apenas em badges grandes)
        if (!small) ctx.fill();
        ctx.fillStyle = '#F0F2F8';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, bx + padX + (small ? 0 : 8), by + h / 2 + 0.5);
        ctx.restore();
    }

    function render() {
        const now = performance.now();
        drawBase(now);

        // lança novos arcos (até 3 simultâneos)
        if (flights.length < 3 && now - lastLaunch > 750) launch(now);

        // arcos em voo
        flights = flights.filter((f) => {
            const raw = (now - f.start) / f.dur;
            if (raw >= 1) {
                arrivals.push({ x: f.to.x, y: f.to.y, name: f.name, start: now });
                return false;
            }
            const tHead = easeInOut(Math.min(raw * 1.12, 1));
            const tTail = easeInOut(Math.max(raw * 1.12 - 0.38, 0));
            drawFlightPath(f, tHead, tTail, 1);
            const head = bezier(f, tHead);
            ctx.fillStyle = GOLD;
            ctx.shadowColor = GOLD; ctx.shadowBlur = 10;
            ctx.beginPath(); ctx.arc(head.x, head.y, 2.6, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
            return true;
        });

        // chegadas: burst + badge (2.2s)
        arrivals = arrivals.filter((a) => {
            const t = (now - a.start) / 2200;
            if (t >= 1) return false;
            const burst = Math.min(t * 3, 1);
            ctx.strokeStyle = `rgba(210, 174, 109, ${0.6 * (1 - burst)})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(a.x, a.y, 4 + burst * 14, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = GOLD;
            ctx.beginPath(); ctx.arc(a.x, a.y, 2.4, 0, Math.PI * 2); ctx.fill();
            const alpha = t < 0.12 ? t / 0.12 : (t > 0.8 ? (1 - t) / 0.2 : 1);
            drawBadge(a.x, a.y, a.name, alpha);
            return true;
        });
    }

    // versão estática (reduced motion): mapa + todos os arcos finos
    function drawStatic() {
        drawBase(0);
        for (const cap of CAPITAIS) {
            const to = project(cap[1], cap[2]);
            const from = project(SP.lat, SP.lon);
            const f = { from, to, cx: (from.x + to.x) / 2, cy: (from.y + to.y) / 2 - 26 };
            drawFlightPath(f, 1, 0, 0.35);
            ctx.fillStyle = GOLD_SOFT;
            ctx.beginPath(); ctx.arc(to.x, to.y, 2, 0, Math.PI * 2); ctx.fill();
        }
    }

    // ---- Interação de mouse (desktop) ----
    canvas.addEventListener('mousemove', (e) => {
        const r = canvas.getBoundingClientRect();
        mouse.x = (e.clientX - r.left) * (W / r.width);
        mouse.y = (e.clientY - r.top) * (H / r.height);
        mouse.active = true;
    }, { passive: true });
    canvas.addEventListener('mouseleave', () => { mouse.active = false; });

    // ---- Ciclo de vida ----
    if (!wrap.clientWidth) {
        // container ainda sem largura (fonte/layout pendente) — tenta no próximo frame
        requestAnimationFrame(() => requestAnimationFrame(resize));
    }
    resize();
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 180);
    }, { passive: true });

    if (prefersReduced) { drawStatic(); return; }

    const io = new IntersectionObserver((entries) => {
        const visible = entries[0].isIntersecting;
        if (visible && !running) { running = true; gsap.ticker.add(render); }
        else if (!visible && running) { running = false; gsap.ticker.remove(render); }
    }, { rootMargin: '60px' });
    io.observe(canvas);
}
