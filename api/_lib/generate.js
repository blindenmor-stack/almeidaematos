// ============================================================================
// Motor de geração de post — compartilhado entre o cron e o /api/admin/generate
// Fluxo: pauta (filtro de duplicidade) → LLM (JSON estruturado) → lint de estilo
//        → passe(s) de revisão → validação → capa → insert → log
// ============================================================================

import { sbFetch, getSettings, logGeneration } from './supabase.js';
import { callLLM } from './llm.js';
import { generateCover } from './cover.js';
import {
    buildArticlePrompt, buildTopicPrompt, buildReviewPrompt, buildDuplicateCheckPrompt,
    RESPONSE_SCHEMA, TOPIC_RESPONSE_SCHEMA, REVIEW_SCHEMA, DUPLICATE_CHECK_SCHEMA, CATEGORIES,
} from './prompt.js';
import { SLUG_RE, slugify, sanitizeHtml, countWords, nowInSaoPaulo } from './util.js';
import { lintArticle, stripBlockquotes } from './style-lint.js';
import { LEGACY_SLUGS } from './legacy-slugs.js';

const MIN_WORDS = 600;
/** Quantos passes de revisão de estilo no máximo por artigo. */
const MAX_REVIEWS = 2;
/** Depois disso (ms desde o início) não inicia revisão nova — a function tem 300s. */
const REVIEW_DEADLINE_MS = 170_000;
/** Se sobrar tique grave após as revisões, o post entra como rascunho em vez de publicar. */
const STYLE_GATE = true;
/** Quantas pautas o cron testa contra duplicidade antes de desistir. */
const MAX_TOPIC_ATTEMPTS = 4;

/** Garante slug único: se colidir com posts existentes, sufixa -2, -3... */
async function ensureUniqueSlug(slug) {
    let base = SLUG_RE.test(slug) ? slug : slugify(slug);
    if (!base) throw new Error('Slug vazio após normalização');
    base = base.slice(0, 120);

    // Busca slugs iguais ou com sufixo numérico em uma query só
    const rows = await sbFetch(`blog_posts?slug=like.${encodeURIComponent(base + '*')}&select=slug`);
    const taken = new Set((rows || []).map((r) => r.slug));
    // Slugs dos 491 posts legados (SSG) também são indisponíveis: o arquivo
    // estático teria precedência sobre o rewrite e o post novo nunca apareceria.
    for (const s of LEGACY_SLUGS) {
        if (s === base || s.startsWith(base + '-')) taken.add(s);
    }
    if (!taken.has(base)) return base;
    for (let i = 2; i <= 50; i++) {
        const candidate = `${base}-${i}`;
        if (!taken.has(candidate)) return candidate;
    }
    throw new Error(`Slug esgotado: ${base}`);
}

/** Normaliza a categoria pra uma das existentes (fallback: Benefícios INSS). */
function normalizeCategory(article, topic) {
    const bySlug = CATEGORIES.find((c) => c.slug === article.category_slug);
    if (bySlug) return bySlug;
    const byName = CATEGORIES.find((c) => c.name.toLowerCase() === String(article.category || '').toLowerCase());
    if (byName) return byName;
    const byTopic = CATEGORIES.find((c) => c.slug === topic?.category_slug);
    return byTopic || CATEGORIES.find((c) => c.slug === 'beneficios-inss');
}

/** Valida e limpa o artigo retornado pela IA. Lança se inválido. */
export function validateArticle(article) {
    if (!article.title || article.title.length < 10) throw new Error('Título inválido');
    const contentHtml = sanitizeHtml(stripBlockquotes(article.content_html));
    const words = countWords(contentHtml);
    if (words < MIN_WORDS) throw new Error(`Conteúdo curto demais: ${words} palavras (mínimo ${MIN_WORDS})`);

    let faq = article.faq;
    if (!Array.isArray(faq)) faq = [];
    faq = faq
        .filter((f) => f && f.question && f.answer)
        .map((f) => ({ question: String(f.question).slice(0, 300), answer: String(f.answer).slice(0, 1500) }))
        .slice(0, 8);

    return {
        contentHtml,
        faq,
        words,
        excerpt: String(article.excerpt || '').slice(0, 300),
        metaTitle: String(article.meta_title || article.title).slice(0, 70),
        metaDescription: String(article.meta_description || article.excerpt || '').slice(0, 170),
        readTime: /^\d{1,2}\s?min$/.test(String(article.read_time || '').trim())
            ? String(article.read_time).trim()
            : `${Math.max(1, Math.ceil(words / 200))} min`,
    };
}

/** Extrai os hrefs internos (/beneficios/...) do HTML pra auditoria em internal_links. */
function extractInternalLinks(html) {
    const links = [];
    const re = /href\s*=\s*"(\/beneficios\/[a-z0-9-]+\/?)"/gi;
    let m;
    while ((m = re.exec(html)) !== null) links.push(m[1]);
    return [...new Set(links)];
}

/** Títulos publicados recentes (pra evitar repetição de tema e de estrutura). */
async function recentPublishedTitles(limit = 40) {
    const rows = await sbFetch(`blog_posts?status=eq.published&order=published_at.desc&limit=${limit}&select=title`);
    return (rows || []).map((r) => r.title).filter(Boolean);
}

/**
 * Pergunta ao LLM se a pauta repete um artigo publicado. Falha → não é duplicata
 * (o filtro nunca pode derrubar a geração).
 */
export async function checkDuplicateTopic({ topic, recentTitles, model }) {
    if (!recentTitles?.length) return { duplicate: false };
    try {
        const { result } = await callLLM({
            model,
            prompt: buildDuplicateCheckPrompt({ topic, recentTitles }),
            responseSchema: DUPLICATE_CHECK_SCHEMA,
        });
        return {
            duplicate: result?.duplicate === true,
            similar_title: String(result?.similar_title || ''),
            reason: String(result?.reason || ''),
        };
    } catch (err) {
        console.warn('[generate] filtro de duplicidade falhou, seguindo sem ele:', err.message);
        return { duplicate: false };
    }
}

/** Escolhe a pauta: por id, texto livre, ou a pending de maior prioridade (sem duplicar tema). */
async function pickTopic({ topicId, topicText, settings, model, recentTitles }) {
    if (topicText) {
        // Pauta livre digitada no admin — cria registro pra rastreabilidade
        const rows = await sbFetch('blog_topics', {
            method: 'POST',
            body: { topic: String(topicText).slice(0, 500), status: 'pending', priority: 10, notes: 'Pauta livre via admin', source: 'manual' },
        });
        return rows[0];
    }
    if (topicId) {
        const rows = await sbFetch(`blog_topics?id=eq.${encodeURIComponent(topicId)}&limit=1`);
        if (!rows?.length) throw new Error(`Pauta ${topicId} não encontrada`);
        return rows[0];
    }

    // Maior prioridade pendente (desempate: mais antiga), pulando as que repetem tema publicado
    const skipped = [];
    for (let attempt = 0; attempt < MAX_TOPIC_ATTEMPTS; attempt++) {
        const filter = skipped.length ? `&id=not.in.(${skipped.join(',')})` : '';
        const rows = await sbFetch(`blog_topics?status=eq.pending${filter}&order=priority.desc,created_at.asc&limit=1`);
        if (!rows?.length) break;
        const candidate = rows[0];
        const dup = await checkDuplicateTopic({ topic: candidate, recentTitles, model });
        if (!dup.duplicate) return candidate;

        const { ymd } = nowInSaoPaulo();
        const note = `[auto ${ymd}] Descartada antes de gerar: repete "${dup.similar_title}". ${dup.reason}`;
        await sbFetch(`blog_topics?id=eq.${candidate.id}`, {
            method: 'PATCH',
            body: { status: 'discarded', notes: `${candidate.notes ? candidate.notes + '\n\n' : ''}${note}`.slice(0, 3000) },
        });
        skipped.push(candidate.id);
        console.warn(`[generate] pauta duplicada descartada: "${candidate.topic}" ≈ "${dup.similar_title}"`);
    }

    // Fila vazia → IA sugere uma pauta nova baseada na linha editorial
    const { result: suggestion } = await callLLM({
        model,
        prompt: buildTopicPrompt({ settings, recentTitles }),
        responseSchema: TOPIC_RESPONSE_SCHEMA,
    });
    const created = await sbFetch('blog_topics', {
        method: 'POST',
        body: {
            topic: String(suggestion.topic || '').slice(0, 500),
            target_keyword: suggestion.target_keyword,
            category: suggestion.category,
            category_slug: suggestion.category_slug,
            product_slug: suggestion.product_slug,
            priority: 5,
            status: 'pending',
            notes: 'Pauta gerada por IA (fila vazia)',
            source: 'manual',
        },
    });
    return created[0];
}

/** Desfaz escape duplo que o modelo às vezes devolve dentro de strings de tool-use ("\\n" literal). */
function unescapeLiteral(str) {
    return String(str)
        .replace(/\\r?\\n/g, '\n')
        .replace(/\\t/g, ' ')
        .replace(/\\"/g, '"');
}

/** Aplica os campos revisados por cima do artigo, sem perder nada que a revisão não devolveu. */
function mergeRevision(article, revised) {
    if (!revised) return article;
    const out = { ...article };
    for (const k of ['title', 'excerpt', 'meta_title', 'meta_description', 'content_html']) {
        if (typeof revised[k] === 'string' && revised[k].trim()) out[k] = unescapeLiteral(revised[k]).trim();
    }
    if (Array.isArray(revised.faq) && revised.faq.length >= 3) {
        out.faq = revised.faq.map((f) => ({ question: unescapeLiteral(f?.question || ''), answer: unescapeLiteral(f?.answer || '') }));
    }
    return out;
}

/**
 * Lint + passes de revisão de estilo. Reutilizado pelo cron e pelo script de
 * reescrita do acervo (scripts/blog.mjs rewrite).
 * @returns {Promise<{article, lint, reviews, history}>}
 */
export async function polishArticle({ article, settings, model, started = Date.now(), maxReviews = MAX_REVIEWS, deadlineMs = REVIEW_DEADLINE_MS }) {
    let current = { ...article, content_html: stripBlockquotes(article.content_html) };
    let lint = lintArticle(current);
    const history = [{ pass: 0, hard: lint.hard, soft: lint.soft, summary: lint.summary }];
    let reviews = 0;

    // 1º passe: qualquer tique grave ou 3+ avisos. Passes seguintes: só se sobrar grave.
    const needsReview = () => (reviews === 0 ? lint.hard > 0 || lint.soft >= 3 : lint.hard > 0);

    while (needsReview() && reviews < maxReviews && Date.now() - started < deadlineMs) {
        const { result: revised } = await callLLM({
            model,
            prompt: buildReviewPrompt({ article: current, lint, settings }),
            responseSchema: REVIEW_SCHEMA,
        });
        current = mergeRevision(current, revised);
        current.content_html = stripBlockquotes(current.content_html);
        reviews++;
        lint = lintArticle(current);
        history.push({ pass: reviews, hard: lint.hard, soft: lint.soft, summary: lint.summary, changes: String(revised?.changes_summary || '').slice(0, 300) });
    }

    return { article: current, lint, reviews, history };
}

/**
 * Gera 1 post completo. Retorna { post, topic, words, lint }.
 * @param {object} opts - { triggerSource: 'cron'|'manual', topicId?, topicText? }
 */
export async function generatePost({ triggerSource, topicId = null, topicText = null }) {
    const started = Date.now();
    const settings = await getSettings();
    const model = settings.model || 'gemini-pro-latest';
    let topic = null;
    let postId = null;

    try {
        const recentTitles = await recentPublishedTitles(40);
        topic = await pickTopic({ topicId, topicText, settings, model, recentTitles });

        // Slugs recentes pra IA evitar repetição de tema
        const recentRows = await sbFetch('blog_posts?order=created_at.desc&limit=40&select=slug');
        const existingSlugs = (recentRows || []).map((r) => r.slug);

        const { result: draft } = await callLLM({
            model,
            prompt: buildArticlePrompt({ topic, settings, existingSlugs, recentTitles }),
            responseSchema: RESPONSE_SCHEMA,
        });

        const { article, lint, reviews } = await polishArticle({ article: draft, settings, model, started });

        const clean = validateArticle(article);
        const slug = await ensureUniqueSlug(article.slug || slugify(article.title));
        const category = normalizeCategory(article, topic);
        const styleBlocked = STYLE_GATE && lint.hard > 0;
        const publishNow = settings.auto_publish !== false && !styleBlocked;

        // Capa na identidade da marca (Nano Banana Pro) — best-effort
        const coverUrl = await generateCover({ slug, title: article.title, category: category.name });

        const inserted = await sbFetch('blog_posts', {
            method: 'POST',
            body: {
                title: String(article.title).slice(0, 300),
                slug,
                cover_url: coverUrl,
                excerpt: clean.excerpt,
                content_html: clean.contentHtml,
                category: category.name,
                category_slug: category.slug,
                author: 'Equipe Almeida & Matos',
                read_time: clean.readTime,
                status: publishNow ? 'published' : 'draft',
                origin: 'ai',
                meta_title: clean.metaTitle,
                meta_description: clean.metaDescription,
                faq: clean.faq,
                internal_links: extractInternalLinks(clean.contentHtml),
                target_keyword: article.target_keyword || topic.target_keyword || null,
                published_at: publishNow ? new Date().toISOString() : null,
            },
        });
        const post = inserted[0];
        postId = post.id;

        // Marca a pauta como usada
        await sbFetch(`blog_topics?id=eq.${topic.id}`, {
            method: 'PATCH',
            body: { status: 'used', used_at: new Date().toISOString() },
        });

        const styleNote = styleBlocked
            ? `estilo REPROVADO (${lint.summary}) → rascunho para revisão humana`
            : `estilo ok${lint.soft ? ` (avisos: ${lint.summary})` : ''}`;
        await logGeneration({
            trigger_source: triggerSource,
            topic_id: topic.id,
            post_id: postId,
            status: 'success',
            detail: `"${post.title}" (${clean.words} palavras, status: ${post.status}) | ${styleNote} | ${reviews} revisão(ões)`,
            model,
            duration_ms: Date.now() - started,
        });

        return { post, topic, words: clean.words, lint, reviews };
    } catch (err) {
        await logGeneration({
            trigger_source: triggerSource,
            topic_id: topic?.id || null,
            post_id: postId,
            status: 'error',
            detail: String(err.message).slice(0, 900),
            model,
            duration_ms: Date.now() - started,
        });
        throw err;
    }
}
