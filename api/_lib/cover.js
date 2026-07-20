// ============================================================================
// Capa do post — gerada pelo Nano Banana Pro (Gemini image) na identidade A&M
// e publicada no Supabase Storage (bucket público `blog-covers`).
//
// Best-effort por design: qualquer falha aqui NUNCA bloqueia a publicação do
// post — ele sai com a capa padrão do site (og-cover.jpg).
// ============================================================================

const IMAGE_MODEL = 'nano-banana-pro-preview';

/**
 * Prompt de capa com direção de arte fixa da marca:
 * composição editorial abstrata, navy #354271/#141B38 + dourado #D2AE6D,
 * geometria triangular (gramática do manual), sem texto e sem pessoas reais
 * identificáveis — o tema do artigo entra como cena/metáfora central.
 */
function buildCoverPrompt({ title, category }) {
    return `Crie uma imagem de capa editorial premium para um artigo de blog jurídico brasileiro.

TEMA DO ARTIGO: "${title}" (categoria: ${category || 'Direito Previdenciário'})

DIREÇÃO DE ARTE OBRIGATÓRIA (identidade da marca Almeida & Matos):
- Paleta dominante: azul-marinho profundo (#141B38, #354271) com acentos em dourado (#D2AE6D)
- Linguagem geométrica: formas triangulares, diagonais nítidas, montanhas estilizadas — nunca curvas orgânicas
- Estilo: ilustração editorial minimalista e sofisticada, flat com profundidade sutil (camadas, luz dourada lateral)
- Um elemento visual central que represente o TEMA do artigo de forma metafórica e digna (ex.: documentos, balança, aperto de mãos, capacete de obra, família — conforme o tema)
- Fundo: gradiente navy escuro com textura sutil de pontos ou triângulos discretos
- SEM texto, SEM letras, SEM logotipos, SEM rostos fotorrealistas
- Tom emocional: seriedade acolhedora, esperança, dignidade — nunca drama ou tragédia
- Composição horizontal 16:9, elemento central levemente à direita (espaço de respiro à esquerda)`;
}

// O modelo de imagem devolve 503 "high demand" com alguma frequência, e é
// transitório: sem repetir, o post é publicado sem capa PARA SEMPRE (nada
// reprocessa depois). Estes são os status que valem nova tentativa.
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [3000, 9000];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function generateImageOnce({ title, category }) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY não configurada');
    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${key}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: buildCoverPrompt({ title, category }) }] }],
                generationConfig: {
                    responseModalities: ['IMAGE'],
                    imageConfig: { aspectRatio: '16:9' },
                },
            }),
        }
    );
    if (!res.ok) {
        const err = new Error(`nano-banana-pro ${res.status}: ${(await res.text()).slice(0, 300)}`);
        err.status = res.status;
        throw err;
    }
    const data = await res.json();
    const part = (data.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data);
    if (!part) {
        // Resposta vazia costuma ser bloqueio de segurança momentâneo — tentar de novo é válido.
        const err = new Error('nano-banana-pro: resposta sem imagem');
        err.status = 503;
        throw err;
    }
    return { buffer: Buffer.from(part.inlineData.data, 'base64'), mime: part.inlineData.mimeType || 'image/png' };
}

/** Tenta gerar a imagem até MAX_ATTEMPTS quando a falha é transitória. */
async function generateImage({ title, category }) {
    let lastErr;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            return await generateImageOnce({ title, category });
        } catch (err) {
            lastErr = err;
            const canRetry = RETRYABLE.has(err.status) && attempt < MAX_ATTEMPTS;
            if (!canRetry) throw err;
            const wait = BACKOFF_MS[attempt - 1] ?? 9000;
            console.warn(`[cover] tentativa ${attempt}/${MAX_ATTEMPTS} falhou (${err.status}); repetindo em ${wait / 1000}s`);
            await sleep(wait);
        }
    }
    throw lastErr;
}

async function uploadToStorage({ slug, buffer, mime }) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) throw new Error('Supabase env ausente');
    const ext = mime.includes('jpeg') ? 'jpg' : 'png';
    const path = `blog-covers/${slug}.${ext}`;
    const res = await fetch(`${url}/storage/v1/object/${path}`, {
        method: 'POST',
        headers: {
            // sb_secret_* não é JWT — o Storage exige o header `apikey`
            apikey: key,
            Authorization: `Bearer ${key}`,
            'Content-Type': mime,
            'x-upsert': 'true',
            'Cache-Control': 'public, max-age=31536000, immutable',
        },
        body: buffer,
    });
    if (!res.ok) throw new Error(`storage ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return `${url}/storage/v1/object/public/${path}`;
}

/**
 * Gera e publica a capa. Retorna a URL pública ou null (nunca lança).
 */
export async function generateCover({ slug, title, category }) {
    try {
        const t0 = Date.now();
        const img = await generateImage({ title, category });
        const coverUrl = await uploadToStorage({ slug, buffer: img.buffer, mime: img.mime });
        console.log(`[cover] ${slug} gerada em ${Math.round((Date.now() - t0) / 1000)}s (${Math.round(img.buffer.length / 1024)}KB)`);
        return coverUrl;
    } catch (err) {
        console.error(`[cover] falhou para ${slug} — post segue com capa padrão:`, err.message);
        return null;
    }
}
