import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/**
 * Globo 3D "Atendemos o Brasil inteiro" — canvas 2D puro (sem three.js).
 *
 * Projeção ortográfica de uma esfera de pontos (terra + Brasil em destaque
 * dourado), com arcos 3D partindo de São Paulo para os 26 estados restantes.
 * A regra central do motion design: NADA muda de forma seca — rotação, glow
 * de estados, pitch, badges e auto-rotação convergem por lerp/damping.
 *
 * Performance: vetores base pré-computados em Float32Array, zero alocação
 * por frame (buffers e pools reutilizados), desenho dos pontos em lotes por
 * nível de alpha (counting por bucket), gsap.ticker como único loop,
 * IntersectionObserver + visibilitychange pausam tudo fora de vista.
 */

gsap.registerPlugin(ScrollTrigger);

const DEV = import.meta.env.DEV;
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

// ---- Paleta (design system A&M) ----
const GOLD = { r: 210, g: 174, b: 109 };   // --color-gold-500
const GOLD_HI = { r: 226, g: 200, b: 147 };  // --color-gold-300
const GOLD_CSS = 'rgb(210,174,109)';
const ARC_CSS = 'rgb(232,209,164)';   // gold-300 — rastro dos arcos
const HEAD_CSS = 'rgb(255,244,222)';  // núcleo branco-quente da cabeça
const WORLD_CSS = 'rgb(151,163,204)';
const TXT_CSS = '#F0F2F8';
const BADGE_BG = 'rgba(13,18,38,0.92)';
const BADGE_BORDER = 'rgba(210,174,109,0.5)';
const FONT_BADGE = '600 11.5px "Plus Jakarta Sans", sans-serif';
const FONT_SP = '600 10px "Plus Jakarta Sans", sans-serif';

// ---- Câmera / motion ----
const SP_CITY = { lat: -23.55, lon: -46.63 };       // origem dos arcos (cidade)
const YAW_HOME = 53 * DEG;                          // Brasil (lon −53°) de frente
const PITCH_BASE = -0.32;                           // hemisfério sul confortável
const PITCH_MIN = -0.75, PITCH_MAX = 0.30;          // limites do drag vertical
const AUTO_VEL = 0.0016;                            // rad/frame @60fps
const DRAG_K = 0.005;                               // rad por pixel de arrasto
const INERTIA_DAMP = 0.94;                          // damping da inércia /frame
const AUTO_BLEND_K = 0.03;                          // crossfade auto-rotação ~2s
const GLOW_K = 0.08;                                // lerp do glow de estado /frame

// ---- Arcos / badges ----
const MAX_ARCS = 3;
const LAUNCH_EVERY = 1100;                          // ms entre lançamentos
const ARC_SAMPLES = 26;                             // amostras do rastro por frame
const WAVE_MS = 400;                                // onda radial de acendimento
const HOLD_MS = 1800;                               // estado seguro aceso
const BADGE_LIFE = 2400, BADGE_IN = 260, BADGE_OUT = 300;
const N_BUCKETS = 12;                               // níveis de alpha p/ batch

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
// easeOutBack com overshoot suave (c1 = 1.2, spec)
function backOut(t) {
    const c1 = 1.2, c3 = c1 + 1;
    const u = t - 1;
    return 1 + c3 * u * u * u + c1 * u * u;
}

// roundRect com fallback (Safari < 16)
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

// lat/lon → vetor unitário (φ=lat, λ=lon): x=cosφ·sinλ, y=sinφ, z=cosφ·cosλ
function toVec(out, off, lat, lon) {
    const phi = lat * DEG, lam = lon * DEG, cp = Math.cos(phi);
    out[off] = cp * Math.sin(lam);
    out[off + 1] = Math.sin(phi);
    out[off + 2] = cp * Math.cos(lam);
}

export function initGlobe({ prefersReduced } = {}) {
    const canvas = document.getElementById('brasilCanvas');
    if (!canvas) return;
    // Esconde o wrapper JÁ (síncrono) — a entrada custom assume depois do fetch;
    // sem isso a seção pisca quando o usuário chega antes do JSON (ex: #brasil direto).
    if (!prefersReduced) gsap.set(canvas.parentElement, { opacity: 0, y: 24, scale: 0.94 });
    const section = canvas.closest('section');

    fetch('/geo/globe-data.json')
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('geo ' + r.status))))
        .then((data) => boot(canvas, section, data, !!prefersReduced))
        .catch((err) => {
            // Falha de dados: a seção some silenciosamente, sem quebrar a página.
            if (DEV) console.warn('[globe] dados indisponíveis — seção oculta', err);
            if (section) { section.style.display = 'none'; ScrollTrigger.refresh(); }
        });
}

function boot(canvas, section, data, reduced) {
    const ctx = canvas.getContext('2d');
    const wrap = canvas.parentElement;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label',
        'Globo 3D com o Brasil em destaque e arcos de atendimento partindo de São Paulo para todos os estados');

    // ================================================================
    // Dados → typed arrays (1x). Coordenadas vêm quantizadas ×100.
    // ================================================================
    const nw = data.world.length, nb = data.brazil.length, nu = data.ufs.length;
    const ufs = data.ufs;
    const spUfIdx = Math.max(0, ufs.findIndex((u) => u.uf === 'SP'));

    const worldVec = new Float32Array(nw * 3);
    const worldRad = new Float32Array(nw);   // raio base (px)
    const worldRadS = new Float32Array(nw);  // raio escalado p/ viewport
    for (let i = 0; i < nw; i++) {
        toVec(worldVec, i * 3, data.world[i][0] / 100, data.world[i][1] / 100);
        worldRad[i] = 1.0 + Math.random() * 0.6;
    }

    const brazilVec = new Float32Array(nb * 3);
    const brazilRad = new Float32Array(nb);
    const brazilRadS = new Float32Array(nb);
    const brazilUf = new Uint8Array(nb);
    const brazilGlow = new Float32Array(nb);    // corrente [0,1] — só lerp
    const brazilDelay = new Float32Array(nb);   // atraso (ms) do stagger radial
    for (let i = 0; i < nb; i++) {
        const p = data.brazil[i];
        toVec(brazilVec, i * 3, p[0] / 100, p[1] / 100);
        brazilRad[i] = 1.3 + Math.random() * 0.7;
        brazilUf[i] = p[2];
    }

    // Stagger radial: distância lat/lon de cada dot ao centroide do seu UF,
    // normalizada pelo raio do UF → atraso 0..WAVE_MS (onda de acendimento).
    {
        const maxD = new Float32Array(nu);
        const dist = new Float32Array(nb);
        for (let i = 0; i < nb; i++) {
            const u = ufs[brazilUf[i]];
            const d = Math.hypot(data.brazil[i][0] / 100 - u.lat, data.brazil[i][1] / 100 - u.lon);
            dist[i] = d;
            if (d > maxD[brazilUf[i]]) maxD[brazilUf[i]] = d;
        }
        for (let i = 0; i < nb; i++) {
            brazilDelay[i] = (dist[i] / (maxD[brazilUf[i]] || 1)) * WAVE_MS;
        }
    }

    const ufVec = new Float32Array(nu * 3);
    for (let i = 0; i < nu; i++) toVec(ufVec, i * 3, ufs[i].lat, ufs[i].lon);
    const spVec = new Float32Array(3);
    toVec(spVec, 0, SP_CITY.lat, SP_CITY.lon);

    // Buffers de tela reutilizados (zero alocação por frame)
    const worldSX = new Float32Array(nw), worldSY = new Float32Array(nw);
    const worldBucket = new Uint8Array(nw);
    const brazilSX = new Float32Array(nb), brazilSY = new Float32Array(nb);
    const brazilDepth = new Float32Array(nb);
    const brazilBucket = new Uint8Array(nb);   // 255 = fora do batch (tem glow)
    const glowIdx = new Uint16Array(nb);
    const ufSX = new Float32Array(nu), ufSY = new Float32Array(nu), ufZ = new Float32Array(nu);
    const arcX = new Float32Array(ARC_SAMPLES), arcY = new Float32Array(ARC_SAMPLES), arcA = new Float32Array(ARC_SAMPLES);

    // Alphas centrais por bucket (back→front) e cores de glow pré-geradas
    const worldBucketA = new Float32Array(N_BUCKETS);
    const brazilBucketA = new Float32Array(N_BUCKETS);
    for (let b = 0; b < N_BUCKETS; b++) {
        const a = 0.05 + 0.95 * ((b + 0.5) / N_BUCKETS);
        worldBucketA[b] = a * 0.34;
        brazilBucketA[b] = a * 0.9;
    }
    const GLOW_LEVELS = 13; // gold-500 → gold-300, strings prontas (sem alocar no frame)
    const glowFill = new Array(GLOW_LEVELS);
    for (let k = 0; k < GLOW_LEVELS; k++) {
        const t = k / (GLOW_LEVELS - 1);
        const r = Math.round(GOLD.r + (GOLD_HI.r - GOLD.r) * t);
        const g = Math.round(GOLD.g + (GOLD_HI.g - GOLD.g) * t);
        const bl = Math.round(GOLD.b + (GOLD_HI.b - GOLD.b) * t);
        glowFill[k] = `rgb(${r},${g},${bl})`;
    }

    // ================================================================
    // Estado da câmera — valores correntes convergem por lerp p/ alvos
    // ================================================================
    let yaw = YAW_HOME;
    let pitch = PITCH_BASE;
    let yawPrevFrame = yaw;
    let autoBlend = 1;        // peso da auto-rotação (crossfade pós-drag)
    let inertiaVel = 0;       // rad/frame após soltar o drag
    let dragVel = 0;          // velocidade medida durante o drag
    let autoVelScale = 1, autoVelScaleT = 1;   // parallax: ±20% no yawVel
    let pitchPar = 0, pitchParT = 0;           // parallax: alvo de pitch
    const settle = { v: 0 };  // offset de yaw animado na entrada (−0.35 → 0)
    let dragging = false, activePtr = -1, lastPX = 0, lastPY = 0;

    // Arcos / anéis / badges — pools fixos (objetos mutados, nunca recriados)
    const arcs = [];
    for (let i = 0; i < MAX_ARCS; i++) {
        arcs.push({ active: false, uf: 0, ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0, omega: 0, sinOm: 1, t0: 0, dur: 0 });
    }
    const rings = [];
    for (let i = 0; i < 4; i++) rings.push({ active: false, uf: 0, t0: 0 });
    const badges = [];
    for (let i = 0; i < 3; i++) badges.push({ active: false, uf: 0, t0: 0, w: 0, side: 1 });
    const ufWave = new Float64Array(nu).fill(-1);  // timestamp da onda por UF
    let lastLaunch = Infinity;                     // habilitado na entrada da seção

    // Fila embaralhada dos 26 UFs (sem SP) — Fisher-Yates in-place
    const queue = new Uint8Array(nu - 1);
    {
        let q = 0;
        for (let i = 0; i < nu; i++) if (i !== spUfIdx) queue[q++] = i;
    }
    let qPos = queue.length;
    function nextUf() {
        if (qPos >= queue.length) {
            for (let i = queue.length - 1; i > 0; i--) {
                const j = (Math.random() * (i + 1)) | 0;
                const t = queue[i]; queue[i] = queue[j]; queue[j] = t;
            }
            qPos = 0;
        }
        return queue[qPos++];
    }

    // Larguras de texto medidas 1x por spawn (nunca por frame)
    let spBadgeW = 0;

    // ================================================================
    // Viewport
    // ================================================================
    let W = 0, H = 0, R = 0, CX = 0, CY = 0, sizeK = 1, stride = 1;
    let diskGrad = null;

    function resize() {
        const DPR = Math.min(window.devicePixelRatio || 1, 2);
        W = wrap.clientWidth || 320;
        H = W; // aspect 1:1 (spec)
        canvas.width = Math.round(W * DPR);
        canvas.height = Math.round(H * DPR);
        canvas.style.height = `${H}px`;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        CX = W / 2; CY = H / 2;
        R = W * 0.455;
        stride = W < 560 ? 2 : 1;                    // mobile: metade dos pontos
        sizeK = clamp(R / 300, 0.72, 1);             // dots proporcionais ao raio
        for (let i = 0; i < nw; i++) worldRadS[i] = worldRad[i] * sizeK;
        for (let i = 0; i < nb; i++) brazilRadS[i] = brazilRad[i] * sizeK;
        // Disco do globo: gradiente radial com "luz" sutil no alto-esquerdo
        diskGrad = ctx.createRadialGradient(CX - R * 0.2, CY - R * 0.24, R * 0.08, CX, CY, R);
        diskGrad.addColorStop(0, '#1F2A52');   // navy-800
        diskGrad.addColorStop(0.55, '#141B38'); // navy-900
        diskGrad.addColorStop(1, '#0D1226');   // navy-950 (funde com a seção)
        ctx.font = FONT_SP;
        spBadgeW = ctx.measureText('São Paulo · HQ').width;
        if (reduced) drawStatic();
    }

    // ================================================================
    // Desenho
    // ================================================================
    function drawDisk() {
        ctx.fillStyle = diskGrad;
        ctx.beginPath(); ctx.arc(CX, CY, R, 0, TAU); ctx.fill();
        // Rim light dourado fraquíssimo no limbo
        ctx.strokeStyle = 'rgba(210,174,109,0.05)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(CX, CY, R - 1, 0, TAU); ctx.stroke();
        ctx.strokeStyle = 'rgba(210,174,109,0.13)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(CX, CY, R - 0.5, 0, TAU); ctx.stroke();
    }

    /**
     * Um frame completo. Rotação: yaw em Y depois pitch em X —
     *   x1 = x·cosY + z·sinY        (equivale a λ_view = λ + yaw)
     *   z1 = z·cosY − x·sinY
     *   y2 = y·cosP − z1·sinP
     *   z2 = y·sinP + z1·cosP       (z2 > 0 = frente)
     * Tela: X = CX + x1·R ; Y = CY − y2·R.
     * Depth: alpha = 0.05 + 0.95·smoothstep(−0.15, 0.25, z2) — verso a 5%.
     */
    function drawFrame(now, glowLerpK) {
        const yawD = yaw + settle.v;
        const sinY = Math.sin(yawD), cosY = Math.cos(yawD);
        const sinP = Math.sin(pitch), cosP = Math.cos(pitch);

        ctx.clearRect(0, 0, W, H);
        drawDisk();

        // ---- Pontos do mundo: projeta + classifica em buckets de alpha ----
        for (let i = 0; i < nw; i += stride) {
            const o = i * 3;
            const x = worldVec[o], y = worldVec[o + 1], z = worldVec[o + 2];
            const x1 = x * cosY + z * sinY;
            const z1 = z * cosY - x * sinY;
            const y2 = y * cosP - z1 * sinP;
            const z2 = y * sinP + z1 * cosP;
            worldSX[i] = CX + x1 * R;
            worldSY[i] = CY - y2 * R;
            let s = (z2 + 0.15) / 0.4;               // smoothstep(−0.15, 0.25, z2)
            s = s < 0 ? 0 : s > 1 ? 1 : s;
            s = s * s * (3 - 2 * s);
            let b = (s * N_BUCKETS) | 0;
            worldBucket[i] = b > N_BUCKETS - 1 ? N_BUCKETS - 1 : b;
        }
        ctx.fillStyle = WORLD_CSS;
        for (let b = 0; b < N_BUCKETS; b++) {        // back→front
            ctx.globalAlpha = worldBucketA[b];
            ctx.beginPath();
            for (let i = 0; i < nw; i += stride) {
                if (worldBucket[i] !== b) continue;
                const px = worldSX[i], py = worldSY[i], r = worldRadS[i];
                ctx.moveTo(px + r, py);
                ctx.arc(px, py, r, 0, TAU);
            }
            ctx.fill();
        }

        // ---- Brasil: projeta, atualiza glow (lerp) e separa batch/individual ----
        let gi = 0;
        for (let i = 0; i < nb; i++) {
            const o = i * 3;
            const x = brazilVec[o], y = brazilVec[o + 1], z = brazilVec[o + 2];
            const x1 = x * cosY + z * sinY;
            const z1 = z * cosY - x * sinY;
            const y2 = y * cosP - z1 * sinP;
            const z2 = y * sinP + z1 * cosP;
            brazilSX[i] = CX + x1 * R;
            brazilSY[i] = CY - y2 * R;
            let s = (z2 + 0.15) / 0.4;
            s = s < 0 ? 0 : s > 1 ? 1 : s;
            s = s * s * (3 - 2 * s);
            brazilDepth[i] = 0.05 + 0.95 * s;

            // Onda do UF: alvo 1 durante o hold (com atraso radial), senão 0.
            // O desligar é o próprio lerp — fade orgânico, nunca seco.
            let target = 0;
            const ws = ufWave[brazilUf[i]];
            if (ws >= 0) {
                const e = now - ws - brazilDelay[i];
                if (e >= 0 && e < HOLD_MS) target = 1;
            }
            let g = brazilGlow[i];
            g += (target - g) * glowLerpK;
            brazilGlow[i] = g;

            if (g > 0.02) { glowIdx[gi++] = i; brazilBucket[i] = 255; }
            else {
                let b = (s * N_BUCKETS) | 0;
                brazilBucket[i] = b > N_BUCKETS - 1 ? N_BUCKETS - 1 : b;
            }
        }
        ctx.fillStyle = GOLD_CSS;
        for (let b = 0; b < N_BUCKETS; b++) {
            ctx.globalAlpha = brazilBucketA[b];
            ctx.beginPath();
            for (let i = 0; i < nb; i++) {
                if (brazilBucket[i] !== b) continue;
                const px = brazilSX[i], py = brazilSY[i], r = brazilRadS[i];
                ctx.moveTo(px + r, py);
                ctx.arc(px, py, r, 0, TAU);
            }
            ctx.fill();
        }
        // Dots acesos: alpha→1, raio +60%, cor caminha para gold-300
        for (let k = 0; k < gi; k++) {
            const i = glowIdx[k];
            const g = brazilGlow[i];
            ctx.fillStyle = glowFill[(g * (GLOW_LEVELS - 1) + 0.5) | 0];
            ctx.globalAlpha = brazilDepth[i] * (0.9 + 0.1 * g);
            const r = brazilRadS[i] * (1 + 0.6 * g);
            ctx.beginPath();
            ctx.arc(brazilSX[i], brazilSY[i], r, 0, TAU);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // ---- Centroides dos UFs + SP projetados (âncoras de arcos/badges) ----
        for (let i = 0; i < nu; i++) {
            const o = i * 3;
            const x = ufVec[o], y = ufVec[o + 1], z = ufVec[o + 2];
            const x1 = x * cosY + z * sinY;
            const z1 = z * cosY - x * sinY;
            ufSX[i] = CX + x1 * R;
            ufSY[i] = CY - (y * cosP - z1 * sinP) * R;
            ufZ[i] = y * sinP + z1 * cosP;
        }
        const spx1 = spVec[0] * cosY + spVec[2] * sinY;
        const spz1 = spVec[2] * cosY - spVec[0] * sinY;
        const spX = CX + spx1 * R;
        const spY = CY - (spVec[1] * cosP - spz1 * sinP) * R;
        const spZ = spVec[1] * sinP + spz1 * cosP;

        // ---- Arcos: lança, atualiza, desenha (recalculados POR FRAME) ----
        if (!reduced && now - lastLaunch > LAUNCH_EVERY) {
            for (let i = 0; i < MAX_ARCS; i++) {
                if (!arcs[i].active) { launchArc(arcs[i], now); break; }
            }
        }
        for (let i = 0; i < MAX_ARCS; i++) {
            const a = arcs[i];
            if (!a.active) continue;
            const raw = (now - a.t0) / a.dur;
            if (raw >= 1) { arrive(a, now); continue; }
            drawArc(a, raw, sinY, cosY, sinP, cosP);
        }

        // ---- Anéis de chegada (grudados no centroide projetado) ----
        for (let i = 0; i < rings.length; i++) {
            const rg = rings[i];
            if (!rg.active) continue;
            const t = (now - rg.t0) / 750;
            if (t >= 1) { rg.active = false; continue; }
            const depthA = clamp((ufZ[rg.uf] - 0.05) / 0.1, 0, 1);
            if (depthA <= 0.01) continue;
            ctx.strokeStyle = GOLD_CSS;
            ctx.globalAlpha = 0.7 * (1 - t) * depthA;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(ufSX[rg.uf], ufSY[rg.uf], 3 + 13 * easeOutCubic(t), 0, TAU);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        rbCount = 0; // reset do anti-colisão de badges deste frame
        // ---- Marcador SP (pulso) + badge HQ, com fade por profundidade ----
        const spA = clamp((spZ - 0.05) / 0.1, 0, 1);
        if (spA > 0.01) {
            const pulse = (5 + 1.8 * Math.sin(now / 380)) * sizeK;
            ctx.fillStyle = 'rgba(210,174,109,0.18)';
            ctx.globalAlpha = spA;
            ctx.beginPath(); ctx.arc(spX, spY, pulse + 4, 0, TAU); ctx.fill();
            ctx.fillStyle = GOLD_CSS;
            ctx.beginPath(); ctx.arc(spX, spY, 3.4 * sizeK, 0, TAU); ctx.fill();
            ctx.globalAlpha = 1;
            drawBadgeBox(spX, spY, 'São Paulo · HQ', spBadgeW, spA, 1, 1, true);
        }

        // ---- Badges de estados (por cima de tudo) ----
        for (let i = 0; i < badges.length; i++) {
            const bd = badges[i];
            if (!bd.active) continue;
            const age = now - bd.t0;
            if (age >= BADGE_LIFE) { bd.active = false; continue; }
            const depthA = clamp((ufZ[bd.uf] - 0.05) / 0.1, 0, 1); // some no verso
            const tIn = clamp(age / BADGE_IN, 0, 1);
            const aIn = tIn * (2 - tIn); // easeOutQuad
            const aOut = age > BADGE_LIFE - BADGE_OUT ? (BADGE_LIFE - age) / BADGE_OUT : 1;
            const alpha = aIn * aOut * depthA;
            if (alpha <= 0.01) continue;
            const scale = 0.86 + 0.14 * backOut(tIn);
            drawBadgeBox(ufSX[bd.uf], ufSY[bd.uf], ufs[bd.uf].name, bd.w, alpha, scale, bd.side, false);
        }
    }

    function launchArc(slot, now) {
        const uf = nextUf();
        const o = uf * 3;
        slot.active = true;
        slot.uf = uf;
        slot.ax = spVec[0]; slot.ay = spVec[1]; slot.az = spVec[2];
        slot.bx = ufVec[o]; slot.by = ufVec[o + 1]; slot.bz = ufVec[o + 2];
        // Ângulo do grande círculo entre origem e destino (p/ slerp)
        const dot = clamp(slot.ax * slot.bx + slot.ay * slot.by + slot.az * slot.bz, -1, 1);
        slot.omega = Math.acos(dot);
        slot.sinOm = Math.sin(slot.omega) || 1e-6;
        slot.t0 = now;
        // Voo mais longo pra estados distantes; faixa 1.4–2.1s mantém
        // 2–3 arcos simultâneos com lançamentos a cada ~1.1s.
        slot.dur = 1300 + slot.omega * 1600;
        lastLaunch = now;
    }

    function arrive(a, now) {
        a.active = false;
        ufWave[a.uf] = now; // dispara a onda radial de glow no estado
        for (let i = 0; i < rings.length; i++) {
            if (!rings[i].active) { rings[i].active = true; rings[i].uf = a.uf; rings[i].t0 = now; break; }
        }
        spawnBadge(a.uf, now);
    }

    function spawnBadge(uf, now) {
        // Recicla o slot livre — ou o mais antigo (máx. 3 simultâneos)
        let slot = null, oldest = Infinity;
        for (let i = 0; i < badges.length; i++) {
            if (!badges[i].active) { slot = badges[i]; break; }
            if (badges[i].t0 < oldest) { oldest = badges[i].t0; slot = badges[i]; }
        }
        ctx.font = FONT_BADGE;
        slot.w = ctx.measureText(ufs[uf].name).width;
        // Lado escolhido pra caber no canvas (abre "pra fora", flip perto da borda)
        const px = ufSX[uf];
        slot.side = px > W - 150 ? -1 : px < 150 ? 1 : px >= CX ? 1 : -1;
        slot.uf = uf;
        slot.t0 = now;
        slot.active = true;
    }

    /**
     * Badge com leader line diagonal 45° e scale com pivot na ponta da linha
     * (o overshoot do easeOutBack cresce "pra fora" do ponto).
     */
    // Retângulos de badges já posicionados neste frame (anti-colisão, pool fixo)
    const rbX = new Float32Array(6), rbY = new Float32Array(6), rbW = new Float32Array(6), rbH = new Float32Array(6);
    let rbCount = 0;

    function drawBadgeBox(px, py, text, textW, alpha, scale, side, small) {
        const h = small ? 22 : 30;
        const padX = small ? 10 : 14;
        const w = textW + padX * 2;
        const gap = 6 * 0.7071;   // linha começa afastada do ponto (não some no dot)
        const lead = 26 * 0.7071; // diagonal de 26px — leader line de verdade
        const lx = px + side * gap, ly = py - gap;
        const ex = px + side * lead, ey = py - lead;
        let bx = side > 0 ? ex + 3 : ex - 3 - w;
        let by = ey - h + 9;
        bx = clamp(bx, 10, W - w - 10);   // nunca cola na borda
        by = clamp(by, 10, H - h - 10);
        // Anti-colisão: empurra pra cima até não sobrepor badges deste frame
        for (let pass = 0; pass < rbCount; pass++) {
            for (let i = 0; i < rbCount; i++) {
                if (bx < rbX[i] + rbW[i] + 8 && bx + w + 8 > rbX[i] &&
                    by < rbY[i] + rbH[i] + 6 && by + h + 6 > rbY[i]) {
                    by = rbY[i] - h - 8;
                }
            }
        }
        by = clamp(by, 10, H - h - 10);
        if (rbCount < 6) { rbX[rbCount] = bx; rbY[rbCount] = by; rbW[rbCount] = w; rbH[rbCount] = h; rbCount++; }

        ctx.save();
        ctx.globalAlpha = alpha;
        // Leader line dourada clara, do dot até a caixa
        ctx.strokeStyle = 'rgba(232,209,164,0.65)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(ex, ey); ctx.stroke();
        // Caixa (escala em torno da ponta da leader line)
        ctx.translate(ex, ey);
        ctx.scale(scale, scale);
        ctx.translate(-ex, -ey);
        ctx.fillStyle = BADGE_BG;
        ctx.strokeStyle = BADGE_BORDER;
        rrect(ctx, bx, by, w, h, 6);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = TXT_CSS;
        ctx.font = small ? FONT_SP : FONT_BADGE;
        ctx.textBaseline = 'middle';
        ctx.fillText(text, bx + padX, by + h / 2 + 0.5);
        ctx.restore();
    }

    /**
     * Arco 3D: slerp A→B no grande círculo + elevação radial 1 + 0.10·sin(πt),
     * projetado por frame — o arco gruda no globo e acompanha o drag.
     */
    function drawArc(a, raw, sinY, cosY, sinP, cosP) {
        const head = easeInOutCubic(Math.min(1, raw * 1.06));
        const tail = Math.max(0, head - 0.34); // rastro: últimos 34% do percurso
        const inv = 1 / a.sinOm;
        // Elevação proporcional à distância: arcos curtos destacam do relevo,
        // longos desenham voos altos — sempre separados dos dots do Brasil.
        const elevK = 0.07 + 0.13 * Math.min(1, a.omega / 0.9);
        for (let i = 0; i < ARC_SAMPLES; i++) {
            const t = tail + (head - tail) * (i / (ARC_SAMPLES - 1));
            const s1 = Math.sin((1 - t) * a.omega) * inv;
            const s2 = Math.sin(t * a.omega) * inv;
            const elev = 1 + elevK * Math.sin(Math.PI * t);
            const x = (a.ax * s1 + a.bx * s2) * elev;
            const y = (a.ay * s1 + a.by * s2) * elev;
            const z = (a.az * s1 + a.bz * s2) * elev;
            const x1 = x * cosY + z * sinY;
            const z1 = z * cosY - x * sinY;
            const y2 = y * cosP - z1 * sinP;
            const z2 = y * sinP + z1 * cosP;
            arcX[i] = CX + x1 * R;
            arcY[i] = CY - y2 * R;
            let s = (z2 + 0.15) / 0.4;
            s = s < 0 ? 0 : s > 1 ? 1 : s;
            arcA[i] = 0.05 + 0.95 * (s * s * (3 - 2 * s)); // herda o depth-alpha
        }
        // Rastro com gradiente de alpha — gold-300 (mais claro que os dots
        // gold-500 do Brasil, senão o arco se camufla no próprio país)
        ctx.strokeStyle = ARC_CSS;
        ctx.lineWidth = 2.4 * sizeK;
        ctx.lineCap = 'round';
        for (let i = 1; i < ARC_SAMPLES; i++) {
            const k = i / (ARC_SAMPLES - 1);
            ctx.globalAlpha = k * 0.95 * arcA[i];
            ctx.beginPath();
            ctx.moveTo(arcX[i - 1], arcY[i - 1]);
            ctx.lineTo(arcX[i], arcY[i]);
            ctx.stroke();
        }
        // Cabeça: núcleo branco-quente com halo dourado (lê-se sobre qualquer fundo)
        const hx = arcX[ARC_SAMPLES - 1], hy = arcY[ARC_SAMPLES - 1];
        ctx.globalAlpha = arcA[ARC_SAMPLES - 1];
        ctx.shadowColor = GOLD_CSS;
        ctx.shadowBlur = 14;
        ctx.fillStyle = HEAD_CSS;
        ctx.beginPath(); ctx.arc(hx, hy, 2.8 * sizeK, 0, TAU); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }

    // ================================================================
    // Frame estático (prefers-reduced-motion): Brasil de frente,
    // estados levemente acesos, sem loop nem arcos.
    // ================================================================
    function drawStatic() {
        yaw = YAW_HOME; pitch = PITCH_BASE; settle.v = 0;
        brazilGlow.fill(0.35);
        drawFrame(0, 0); // glowLerpK 0 → glow fica no valor setado
    }

    // ================================================================
    // Loop — gsap.ticker único; física + render
    // ================================================================
    let devAcc = 0, devCnt = 0;

    function render() {
        const tDev = DEV ? performance.now() : 0;
        const now = performance.now();
        const dt = Math.min(gsap.ticker.deltaRatio(60), 2.5); // frames normalizados

        // Parallax converge devagar (lerp 0.05 — o globo "acompanha o olhar")
        autoVelScale += (autoVelScaleT - autoVelScale) * Math.min(1, 0.05 * dt);
        pitchPar += (pitchParT - pitchPar) * Math.min(1, 0.05 * dt);

        if (dragging) {
            // Velocidade medida por frame (suavizada) — vira inércia no release
            dragVel += (yaw - yawPrevFrame - dragVel) * 0.35;
            // Auto-rotação cede rápido (mas nunca seco) pro controle do dedo
            autoBlend += (0 - autoBlend) * Math.min(1, 0.25 * dt);
        } else {
            // Crossfade ~2s: inércia decai (0.94^dt) enquanto o peso auto volta
            autoBlend += (1 - autoBlend) * Math.min(1, AUTO_BLEND_K * dt);
            inertiaVel *= Math.pow(INERTIA_DAMP, dt);
            if (inertiaVel > -1e-6 && inertiaVel < 1e-6) inertiaVel = 0;
            yaw += (AUTO_VEL * autoVelScale * autoBlend + inertiaVel) * dt;
            // Pitch volta suave pro enquadramento (base + parallax)
            pitch += (PITCH_BASE + pitchPar - pitch) * Math.min(1, 0.04 * dt);
        }
        yawPrevFrame = yaw;

        drawFrame(now, Math.min(1, GLOW_K * dt));

        if (DEV) {
            devAcc += performance.now() - tDev;
            if (++devCnt === 120) { window.__globeMs = devAcc / 120; devAcc = 0; devCnt = 0; }
        }
    }

    // ================================================================
    // Interação — drag com inércia + hover parallax (desktop)
    // ================================================================
    function bindPointer() {
        canvas.style.touchAction = 'pan-y'; // scroll vertical fica com o browser
        canvas.style.cursor = 'grab';
        const hoverCapable = window.matchMedia('(hover: hover)').matches;

        canvas.addEventListener('pointerdown', (e) => {
            if (activePtr !== -1) return;
            activePtr = e.pointerId;
            dragging = true;
            lastPX = e.clientX; lastPY = e.clientY;
            dragVel = 0; inertiaVel = 0;
            canvas.style.cursor = 'grabbing';
            try { canvas.setPointerCapture(e.pointerId); } catch { /* iframe edge */ }
        });

        canvas.addEventListener('pointermove', (e) => {
            if (hoverCapable && !dragging && W >= 560) {
                // Alvos do parallax: yawVel ±20% (mouseX) e pitch ±0.06 (mouseY)
                const nx = clamp((e.offsetX / W) * 2 - 1, -1, 1);
                const ny = clamp((e.offsetY / H) * 2 - 1, -1, 1);
                autoVelScaleT = 1 + 0.2 * nx;
                pitchParT = ny * 0.06;
            }
            if (!dragging || e.pointerId !== activePtr) return;
            const dx = e.clientX - lastPX, dy = e.clientY - lastPY;
            lastPX = e.clientX; lastPY = e.clientY;
            yaw += dx * DRAG_K; // 1:1 com o dedo — sensação de peso
            if (e.pointerType === 'mouse') {
                pitch = clamp(pitch + dy * DRAG_K, PITCH_MIN, PITCH_MAX);
            }
        }, { passive: true });

        const endDrag = (e) => {
            if (e.pointerId !== activePtr) return;
            activePtr = -1;
            dragging = false;
            inertiaVel = dragVel; // solta girando; damping cuida do resto
            canvas.style.cursor = 'grab';
        };
        canvas.addEventListener('pointerup', endDrag);
        canvas.addEventListener('pointercancel', endDrag); // scroll assumiu (pan-y)
        canvas.addEventListener('pointerleave', () => {
            autoVelScaleT = 1;
            pitchParT = 0;
        });
    }

    // ================================================================
    // Entrada da seção (ScrollTrigger, once) + ciclo de vida
    // ================================================================
    function bindEntrance() {
        // O reveal genérico de [data-reveal] já foi criado pro wrap — mata ele
        // pra entrada do globo ter uma única fonte de verdade (sem fade duplo).
        gsap.set(wrap, { opacity: 0, y: 24, scale: 0.94 });
        ScrollTrigger.create({
            trigger: wrap,
            start: 'top 85%',
            once: true,
            onEnter: () => {
                gsap.to(wrap, { opacity: 1, y: 0, scale: 1, duration: 1.1, ease: 'power3.out', overwrite: 'auto' });
                // Settle: chega girando de leve até o Brasil de frente
                settle.v = -0.35;
                gsap.to(settle, { v: 0, duration: 1.6, ease: 'power2.out' });
                lastLaunch = performance.now() - LAUNCH_EVERY + 600; // 1º arco ~0.6s depois
            },
        });
    }

    // ---- Boot ----
    if (!wrap.clientWidth) {
        // container ainda sem largura (layout pendente) — tenta no próximo frame
        requestAnimationFrame(() => requestAnimationFrame(resize));
    }
    resize();
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 180);
    }, { passive: true });

    if (reduced) { drawStatic(); return; }

    bindPointer();
    bindEntrance();

    // Liga/desliga o loop: visível no viewport E aba ativa
    let running = false, inView = false;
    function syncRunning() {
        const want = inView && !document.hidden;
        if (want && !running) { running = true; gsap.ticker.add(render); }
        else if (!want && running) { running = false; gsap.ticker.remove(render); }
    }
    const io = new IntersectionObserver((entries) => {
        inView = entries[0].isIntersecting;
        syncRunning();
    }, { rootMargin: '60px' });
    io.observe(canvas);
    document.addEventListener('visibilitychange', syncRunning);
}
