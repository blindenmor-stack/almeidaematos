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
    [/acidente|trajeto|\bcat\b|ler|dort|fratura|sequela/i, [
        'capacete de moto e luvas sobre o banco de uma moto de entrega parada numa rua de pedra portuguesa',
        'botas de obra na soleira de uma casa simples',
        'um pulso enfaixado apoiado no balcão de uma oficina, ferramentas desfocadas ao fundo',
        'colete refletivo pendurado num gancho ao lado de um relógio de ponto',
        'bicicleta de entrega encostada num portão de ferro, bolsa térmica no bagageiro',
        'muletas encostadas no banco de um ponto de ônibus vazio',
        'carteira de trabalho e um crachá de empresa sobre a mesa da cozinha',
        'capacete de obra dentro de um armário de vestiário com a porta entreaberta',
        'uma bota de segurança ao lado de uma cadeira de plástico numa varanda',
    ]],
    [/doen[cç]a|incapacidade|per[ií]cia|laudo|alta|inss|benef|acordo|atestado/i, [
        'carta do INSS aberta sobre a mesa da cozinha, óculos de leitura ao lado',
        'envelope pardo e uma caneta sobre um pano de prato xadrez',
        'sala de espera de agência com cadeiras de plástico vazias e luz de janela',
        'pilha de exames com clipe de metal sobre uma cômoda',
        'agenda de papel com uma data circulada, ao lado de um relógio de pulso',
        'cartela de remédios e um copo de água na mesa de cabeceira',
        'telefone fixo antigo ao lado de um bloco de anotações com nomes de médicos',
    ]],
    [/bpc|loas|idoso|defici/i, [
        'mãos de uma pessoa idosa sobre uma toalha de mesa bordada',
        'uma bengala de madeira apoiada na parede de uma sala simples',
        'quintal com roupa no varal e uma cadeira de balanço vazia',
        'rádio antigo sobre a cômoda com um porta-retrato virado para a janela',
        'chinelos ao lado de uma cadeira de rodas numa varanda',
    ]],
    [/invalidez|aposentadoria/i, [
        'cadeira de rodas junto a uma janela aberta com cortina leve',
        'muletas encostadas numa cama arrumada',
        'mãos apoiadas numa bengala de madeira, luz da manhã',
        'uma cadeira vazia na varanda com uma manta dobrada',
        'óculos e um calendário de parede numa cozinha simples',
    ]],
    [/pens[aã]o|morte|fam[ií]lia|vi[uú]v/i, [
        'porta-retrato virado para a janela, cortina ao vento',
        'aliança sobre um lenço dobrado numa cômoda',
        'duas xícaras de café numa mesa de família, uma delas vazia',
        'mãos entrelaçadas sobre uma mesa de madeira',
        'um casaco masculino pendurado atrás de uma porta',
    ]],
    [/indeniza|trabalhista|c[ií]vel|seguro|dpvat|demiss/i, [
        'carteira de trabalho sobre a mesa ao lado de uma chave de carro',
        'uniforme de empresa dobrado numa cadeira',
        'capa de moto sobre uma moto estacionada na garagem de um prédio',
        'crachá de empresa pendurado num prego na parede da cozinha',
        'um contracheque dobrado dentro de um envelope sobre o balcão',
    ]],
];
const DEFAULT_SCENES = [
    'documentos do INSS organizados sobre uma mesa de madeira',
    'mãos preenchendo um formulário numa mesa de cozinha',
    'mesa de trabalho simples com luz de janela e um bloco de anotações',
];
const NAVY_OBJECTS = ['uma pasta azul-marinho', 'uma camisa azul-marinho dobrada', 'uma cadeira pintada de azul-marinho', 'uma porta azul-marinho ao fundo', 'um caderno azul-marinho', 'um boné azul-marinho', 'uma caneca azul-marinho'];
const LIGHTS = ['luz natural quente de fim de tarde', 'luz lateral de janela pela manhã', 'luz difusa de dia nublado', 'luz de janela com sombras suaves'];

/** Hash determinístico: o mesmo post sempre sorteia a mesma cena (regeneração reproduzível). */
function hashOf(str) {
    let h = 2166136261;
    for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    return h;
}

function pickScene({ slug, title, category }) {
    const hit = SCENES_BY_CATEGORY.find(([re]) => re.test(`${category || ''} ${title || ''}`));
    const scenes = hit ? hit[1] : DEFAULT_SCENES;
    const h = hashOf(slug || title);
    return {
        scene: scenes[h % scenes.length],
        navy: NAVY_OBJECTS[(h >>> 3) % NAVY_OBJECTS.length],
        light: LIGHTS[(h >>> 7) % LIGHTS.length],
    };
}

export function buildCoverPrompt({ slug, title, category }) {
    const pick = pickScene({ slug, title, category });
    return `Fotografia editorial para a capa de um artigo de blog de um escritório de advocacia brasileiro (direito previdenciário e acidentes).

TEMA DO ARTIGO: "${title}" (categoria: ${category || 'Direito Previdenciário'})
CENA (obrigatória, uma só): ${pick.scene}. Um único acento azul-marinho na cena: ${pick.navy}. Nada de caneca de café, pasta sobre a mesa ou mãos segurando caneca, a menos que a cena acima diga isso.

ESTILO OBRIGATÓRIO (identidade visual do site):
- Fotografia real, editorial, câmera 35mm, abertura f/2 (fundo suavemente desfocado), enquadramento próximo do objeto principal
- ${pick.light}; sombras suaves; grão fino de filme
- Paleta clara e calma: tons de papel e creme (#F7F5F0), madeira clara, cinza quente; azul-marinho (#354271) só no objeto indicado acima e dourado (#D2AE6D) no máximo num detalhe pequeno, nunca como fundo
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

async function generateImageOnce({ slug, title, category }) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY não configurada');
    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${key}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: buildCoverPrompt({ slug, title, category }) }] }],
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
async function generateImage({ slug, title, category }) {
    let lastErr;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            return await generateImageOnce({ slug, title, category });
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
        const img = await generateImage({ slug, title, category });
        const coverUrl = await uploadToStorage({ slug, buffer: img.buffer, mime: img.mime });
        console.log(`[cover] ${slug} gerada em ${Math.round((Date.now() - t0) / 1000)}s (${Math.round(img.buffer.length / 1024)}KB)`);
        return coverUrl;
    } catch (err) {
        console.error(`[cover] falhou para ${slug} — post segue com capa padrão:`, err.message);
        return null;
    }
}
