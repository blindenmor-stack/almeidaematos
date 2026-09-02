// ============================================================================
// Lint de estilo determinístico — espelha as STYLE_RULES do prompt.js.
// Não substitui a revisão por IA: aponta os tiques mensuráveis (travessão,
// antítese "não é X, é Y", muletas, Title Case, blockquote) pra (1) disparar
// o passe de revisão, (2) barrar publicação automática quando sobra erro
// grave e (3) medir o acervo (scripts/blog.mjs lint).
// ============================================================================

const EM_DASH_RE = /—|(?<=\S)\s–\s(?=\S)/g;

/** Antítese contrastiva com verbo repetido — o tique nº 1 do Bernardo. */
const ANTITHESIS_RES = [
    // \b do JS é ASCII: depois de "é"/"está" não funciona. Por isso (?<!\p{L}) / (?!\p{L}) com flag u.
    /(?<!\p{L})não (?:é|são|se trata de|está|era|foi)(?!\p{L})[^.;:!?<>]{2,80}?,\s*(?:é|são|e sim|mas sim)(?!\p{L})/giu,
    /(?<!\p{L})não (?:é|são) (?:só|apenas|somente)(?!\p{L})[^.;:!?<>]{2,80}?,\s*(?:é|são|mas|e sim)(?!\p{L})/giu,
    /(?<!\p{L})não (?:apenas|só|somente)(?!\p{L})[^.;:!?<>]{2,80}?(?<!\p{L})(?:mas também|mas sim|e sim|como também)(?!\p{L})/giu,
    /o que (?:importa|conta|vale|pesa|muda|define|garante)(?!\p{L})[^.;:!?<>]{0,40}?não é(?!\p{L})[^.;:!?<>]{2,80}?(?:,|;)\s*(?:é|e sim|mas)(?!\p{L})/giu,
    /mais do que [^.;:!?<>]{2,60}?,\s*(?:é|são)(?!\p{L})/giu,
    /não é o problema, (?:é|e sim)(?!\p{L})/giu,
];

const NEG_CADENCE_RE = /(?<!\p{L})(?:sem|nem) [\p{L}\p{N}-]+(?: [\p{L}\p{N}-]+){0,3}, ?(?:sem|nem) [\p{L}\p{N}-]+/giu;

const FILLERS = [
    'vale lembrar', 'vale ressaltar', 'vale destacar', 'vale reunir', 'vale a pena', 'vale revisar',
    'é importante destacar', 'é importante lembrar', 'é importante ressaltar', 'além disso', 'por fim',
    'em resumo', 'ou seja', 'na prática', 'em outras palavras', 'isso significa', 'importante:', 'atenção:',
    'lembre-se',
];

const CLICHES = [
    'mais comum do que parece', 'poucas pessoas sabem', 'muita gente acha', 'muitos trabalhadores se perguntam',
    'essa cena', 'imagine', 'cada caso é um caso', 'de verdade', 'justamente', 'direito real', 'direito sério',
    'neste artigo', 'vamos entender', 'como vimos', 'veja abaixo', 'a seguir', 'você sabia', 'não hesite',
    'esperamos que',
];

const TITLE_BANNED = [
    'checklist completo', 'guia completo', 'tudo sobre', 'entenda', 'veja', 'descubra', 'saiba',
    'o que você precisa saber', 'isso pode indicar', 'por que isso', 'o que ninguém',
];

/** Siglas e nomes próprios que podem ficar em maiúscula no meio do título. */
const PROPER = new Set([
    'INSS', 'CAT', 'LOAS', 'BPC', 'FGTS', 'CID', 'LER', 'DORT', 'DPVAT', 'CLT', 'MEI', 'CNIS', 'CPF', 'RG',
    'PIS', 'NIT', 'PCD', 'LC', 'STF', 'STJ', 'TNU', 'TRF', 'CRPS', 'SUS', 'OAB', 'Lei', 'Justiça', 'Brasil',
    'Caixa', 'Meu', 'Decreto', 'Emenda', 'Constituição', 'Atestmed', 'Previdência', 'Social', 'Almeida', 'Matos',
]);

export function stripHtml(html) {
    return String(html || '')
        .replace(/<\/(p|li|h[1-6]|tr|td|th|div|blockquote)>/gi, '$&\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/[ \t]+/g, ' ')
        .trim();
}

/**
 * Converte <blockquote> em parágrafo comum e remove a atribuição inventada
 * ("— Equipe jurídica Almeida & Matos"). Cinto de segurança determinístico:
 * a revisão por IA já deveria ter feito isso.
 */
export function stripBlockquotes(html) {
    return String(html || '')
        .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, inner) => {
            const text = inner
                .replace(/<\/?p[^>]*>/gi, '')
                .replace(/\s*[—–-]\s*Equipe jurídica[^<]*$/i, '')
                .replace(/\s*[—–-]\s*Equipe Almeida[^<]*$/i, '')
                .trim();
            return text ? `<p>${text}</p>` : '';
        });
}

function countMatches(text, re) {
    const out = [];
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
        out.push(m[0].replace(/\s+/g, ' ').trim().slice(0, 90));
        if (!re.global) break;
    }
    return out;
}

function countPhrases(text, phrases) {
    const low = text.toLowerCase();
    const found = [];
    for (const p of phrases) {
        let idx = 0;
        let n = 0;
        while ((idx = low.indexOf(p, idx)) !== -1) {
            // fronteira de palavra: evita "imagine" dentro de "imagineira" etc.
            const before = idx === 0 ? ' ' : low[idx - 1];
            const after = low[idx + p.length] || ' ';
            if (!/[a-zà-ú]/.test(before) && !/[a-zà-ú]/.test(after)) n++;
            idx += p.length;
        }
        if (n) found.push({ phrase: p, count: n });
    }
    return found;
}

function isTitleCase(title) {
    const words = String(title || '').split(/\s+/).slice(1);
    let caps = 0;
    for (const w of words) {
        const clean = w.replace(/[^\p{L}\p{N}-]/gu, '');
        if (clean.length < 4) continue;
        if (PROPER.has(clean) || clean === clean.toUpperCase()) continue;
        if (/^\p{Lu}/u.test(clean)) caps++;
    }
    return caps >= 2;
}

/**
 * Lint do artigo inteiro. Devolve { issues, hard, soft, summary }.
 * hard = tiques que barram publicação automática; soft = só avisam.
 * @param {object} article - {title, excerpt, meta_title, meta_description, content_html, faq}
 */
export function lintArticle(article = {}) {
    const issues = [];
    const push = (code, label, severity, samples) => {
        if (!samples || !samples.length) return;
        const count = typeof samples === 'number' ? samples : samples.length;
        issues.push({
            code, label, severity, count,
            samples: Array.isArray(samples) ? samples.slice(0, 4) : [],
        });
    };

    const title = String(article.title || '');
    const metaTitle = String(article.meta_title || '');
    const bodyText = stripHtml(article.content_html);
    const faqText = (Array.isArray(article.faq) ? article.faq : [])
        .map((f) => `${f?.question || ''} ${f?.answer || ''}`).join('\n');
    const all = [title, article.excerpt, metaTitle, article.meta_description, bodyText, faqText]
        .map((s) => String(s || '')).join('\n');

    // ---- graves
    push('em_dash', 'Travessão (—)', 'hard', countMatches(all, EM_DASH_RE));
    const antRaw = ANTITHESIS_RES.flatMap((re) => countMatches(all, re));
    // duas regex podem pegar o mesmo trecho: fica só a ocorrência mais longa
    const ant = antRaw.filter((a, i) => !antRaw.some((b, j) => j !== i && b !== a && b.includes(a)));
    push('antithesis', 'Antítese "não é X, é Y"', 'hard', ant);
    if (/<blockquote/i.test(String(article.content_html || ''))) push('blockquote', 'Citação inventada (blockquote)', 'hard', ['<blockquote>']);
    if (isTitleCase(title)) push('title_case', 'Título em Title Case', 'hard', [title]);
    if (isTitleCase(metaTitle)) push('meta_title_case', 'Meta title em Title Case', 'hard', [metaTitle]);
    if (/\b20\d\d\b/.test(title)) push('title_year', 'Ano no título', 'hard', [title]);
    const tb = countPhrases(`${title}\n${metaTitle}`, TITLE_BANNED);
    push('title_banned', 'Gancho de título proibido', 'hard', tb.map((x) => x.phrase));

    // ---- avisos
    push('neg_cadence', 'Lista negativa em cadência ("sem X, sem Y")', 'soft', countMatches(all, NEG_CADENCE_RE));
    const fillers = countPhrases(all, FILLERS);
    push('fillers', 'Muletas e transições vazias', 'soft', fillers.flatMap((x) => Array(x.count).fill(x.phrase)));
    const cliches = countPhrases(all, CLICHES);
    push('cliches', 'Clichês e floreios', 'soft', cliches.flatMap((x) => Array(x.count).fill(x.phrase)));
    push('exclamation', 'Ponto de exclamação', 'soft', countMatches(all, /!/g));
    push('ellipsis', 'Reticências', 'soft', countMatches(all, /\.\.\.|…/g));
    push('informal', '"pra" / "a gente" / "tá"', 'soft', countMatches(all, /(?<!\p{L})(?:pra|a gente|tá)(?!\p{L})/giu));
    const equipe = countMatches(all, /nossa equipe/gi);
    if (equipe.length > 2) push('nossa_equipe', '"nossa equipe" mais de 2 vezes', 'soft', equipe);
    // títulos, itens de lista e células não terminam com ponto: quebra também por linha
    const longSentences = bodyText
        .split(/(?<=[.!?])\s+|\n+/)
        .filter((s) => s.split(/\s+/).length > 32)
        .map((s) => s.slice(0, 90));
    push('long_sentences', 'Frases com mais de 32 palavras', 'soft', longSentences);
    if (title.length > 70) push('title_long', 'Título com mais de 70 caracteres', 'soft', [title]);
    const strongWhole = countMatches(String(article.content_html || ''), /<p>\s*<strong>[^<]{60,}<\/strong>\s*<\/p>/gi);
    push('strong_whole', 'Parágrafo inteiro em negrito', 'soft', strongWhole);

    const hard = issues.filter((i) => i.severity === 'hard').reduce((n, i) => n + i.count, 0);
    const soft = issues.filter((i) => i.severity === 'soft').reduce((n, i) => n + i.count, 0);
    const summary = issues.length
        ? issues.map((i) => `${i.code}=${i.count}`).join(', ')
        : 'sem tiques';

    return { issues, hard, soft, summary };
}
