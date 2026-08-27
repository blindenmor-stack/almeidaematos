// ============================================================================
// Capa do post — gerada pelo Nano Banana Pro (Gemini image) na identidade v5 do site
// e publicada no Supabase Storage (bucket público `blog-covers`).
//
// Best-effort por design: qualquer falha aqui NUNCA bloqueia a publicação do
// post — ele sai com a capa padrão do site (og-cover.jpg).
// ============================================================================

const IMAGE_MODEL = 'nano-banana-pro-preview';

/**
 * Prompt de capa com a direção de arte do site v5 (ago/2026): fotografia
 * editorial de luz natural, tons de papel, azul-marinho e dourado só como
 * acento (a mesma linguagem das imagens do motoboy e do raio-x da home).
 * Sem texto, sem logo, sem rosto em close. O tema do artigo vira uma cena
 * cotidiana e digna, nunca drama.
 */
const SCENES_BY_CATEGORY = [
    [/acidente/i, 'capacete de moto sobre uma mesa, luvas de trabalho, uma moto de entrega parada numa rua de São Paulo, mãos com pulso enfaixado segurando um café, botas de obra na soleira'],
    [/doen[cç]a|incapacidade|per[ií]cia/i, 'mesa de cozinha com exames e receitas médicas organizados, uma cadeira vazia perto da janela, mãos segurando um laudo, cartela de remédios ao lado de um caderno'],
    [/bpc|loas|idoso|defici/i, 'sala simples com luz de fim de tarde, mãos de uma pessoa idosa sobre a mesa, uma bengala apoiada na parede, quintal com roupa no varal'],
    [/invalidez|aposentadoria/i, 'cadeira de rodas junto a uma janela aberta, muletas encostadas numa cama arrumada, varanda com luz da manhã, mãos apoiadas numa bengala de madeira'],
    [/pens[aã]o|morte|fam[ií]lia/i, 'porta-retrato virado para a janela, aliança sobre um lenço, xícaras de café numa mesa de família, mãos entrelaçadas'],
    [/indeniza|trabalhista|c[ií]vel|seguro|dpvat/i, 'carteira de trabalho sobre a mesa, uniforme dobrado numa cadeira, chave de carro ao lado de documentos, capacete de obra num armário'],
];

function sceneHints(category) {
    const hit = SCENES_BY_CATEGORY.find(([re]) => re.test(category || ''));
    return hit ? hit[1] : 'documentos do INSS organizados sobre uma mesa de madeira, uma pasta azul-marinho com papéis, mãos preenchendo um formulário, mesa de trabalho com luz de janela';
}

export function buildCoverPrompt({ title, category }) {
    return `Fotografia editorial para a capa de um artigo de blog de um escritório de advocacia brasileiro (direito previdenciário e acidentes).

TEMA DO ARTIGO: "${title}" (categoria: ${category || 'Direito Previdenciário'})
Traduza o tema em UMA cena cotidiana brasileira, concreta e digna. Sugestões de cena para esta categoria: ${sceneHints(category)}. Escolha a que melhor representa o título.

ESTILO OBRIGATÓRIO (identidade visual do site):
- Fotografia real, editorial, câmera 35mm, abertura f/2 (fundo suavemente desfocado), enquadramento próximo do objeto principal
- Luz natural quente de fim de tarde ou luz lateral de janela; sombras suaves; grão fino de filme
- Paleta clara e calma: tons de papel e creme (#F7F5F0), madeira clara, cinza quente; azul-marinho (#354271) e dourado (#D2AE6D) aparecem só em objetos (uma pasta azul-marinho, um detalhe dourado), nunca como fundo
- Cores levemente dessaturadas, contraste baixo, sensação de calma e recomeço
- Composição horizontal 16:9, objeto principal no centro ou levemente à direita, área de respiro limpa à esquerda
- Ambientes brasileiros reais: cozinha simples, calçada de pedra portuguesa, canteiro de obra, sala de espera, mesa de madeira

PROIBIDO:
- Texto, letras, números, logotipos, marcas d'água, selos
- Rosto em close ou pessoa reconhecível (pessoas só de costas, de lado, fora de foco ou apenas as mãos)
- Ilustração, 3D, flat design, ícones, gráficos, colagem, fundo escuro, gradiente azul, formas geométricas decorativas
- Sangue, ferimento exposto, ambulância, hospital dramático, choro, tragédia
- Balança da justiça, martelo de juiz, toga, clichês jurídicos`;
}

// O modelo de imagem devolve 503 "high demand" com alguma frequência, e é
// transitório: sem repetir, o post é publicado sem capa PARA SEMPRE (nada
// reprocessa depois). Estes são os status que valem nova tentativa.
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 4;
const BACKOFF_MS = [4000, 12000, 25000]; // 27/08: 503 "high demand" durou minutos; 3 tentativas curtas não bastavam

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
