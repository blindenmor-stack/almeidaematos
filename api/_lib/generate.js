// ============================================================================
// Motor de geração de post — compartilhado entre o cron e o /api/admin/generate
// Fluxo: pauta → Gemini (JSON estruturado) → validação → insert → log
// ============================================================================

import { sbFetch, getSettings, logGeneration } from './supabase.js';
import {
    buildArticlePrompt, buildTopicPrompt,
    RESPONSE_SCHEMA, TOPIC_RESPONSE_SCHEMA, CATEGORIES,
} from './prompt.js';
import { SLUG_RE, slugify, sanitizeHtml, countWords } from './util.js';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MIN_WORDS = 600;

/** Chama o Gemini com saída JSON estruturada e retorna o objeto parseado. */
async function callGemini({ model, prompt, responseSchema }) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY não configurada');

    const res = await fetch(`${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: 'application/json',
                responseSchema,
                temperature: 0.7,
                maxOutputTokens: 16384,
            },
        }),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Gemini ${res.status}: ${text.slice(0, 400)}`);
    }

    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) {
        const reason = data?.candidates?.[0]?.finishReason || 'sem candidato';
        throw new Error(`Gemini não retornou texto (${reason})`);
    }
    return JSON.parse(raw);
}

/** Garante slug único: se colidir com posts existentes, sufixa -2, -3... */
async function ensureUniqueSlug(slug) {
    let base = SLUG_RE.test(slug) ? slug : slugify(slug);
    if (!base) throw new Error('Slug vazio após normalização');
    base = base.slice(0, 120);

    // Busca slugs iguais ou com sufixo numérico em uma query só
    const rows = await sbFetch(`blog_posts?slug=like.${encodeURIComponent(base + '*')}&select=slug`);
    const taken = new Set((rows || []).map((r) => r.slug));
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
function validateArticle(article) {
    if (!article.title || article.title.length < 10) throw new Error('Título inválido');
    const contentHtml = sanitizeHtml(article.content_html);
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

/** Escolhe a pauta: por id, texto livre, ou a pending de maior prioridade. */
async function pickTopic({ topicId, topicText, settings }) {
    if (topicText) {
        // Pauta livre digitada no admin — cria registro pra rastreabilidade
        const rows = await sbFetch('blog_topics', {
            method: 'POST',
            body: { topic: String(topicText).slice(0, 500), status: 'pending', priority: 10, notes: 'Pauta livre via admin' },
        });
        return rows[0];
    }
    if (topicId) {
        const rows = await sbFetch(`blog_topics?id=eq.${encodeURIComponent(topicId)}&limit=1`);
        if (!rows?.length) throw new Error(`Pauta ${topicId} não encontrada`);
        return rows[0];
    }
    // Maior prioridade pendente (desempate: mais antiga)
    const rows = await sbFetch('blog_topics?status=eq.pending&order=priority.desc,created_at.asc&limit=1');
    if (rows?.length) return rows[0];

    // Fila vazia → IA sugere uma pauta nova baseada na linha editorial
    const recent = await sbFetch('blog_posts?order=created_at.desc&limit=30&select=title');
    const suggestion = await callGemini({
        model: settings.model || 'gemini-2.5-flash',
        prompt: buildTopicPrompt({ settings, recentTitles: (recent || []).map((r) => r.title) }),
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
        },
    });
    return created[0];
}

/**
 * Gera 1 post completo. Retorna { post, topic, words }.
 * @param {object} opts - { triggerSource: 'cron'|'manual', topicId?, topicText? }
 */
export async function generatePost({ triggerSource, topicId = null, topicText = null }) {
    const started = Date.now();
    const settings = await getSettings();
    const model = settings.model || 'gemini-2.5-flash';
    let topic = null;
    let postId = null;

    try {
        topic = await pickTopic({ topicId, topicText, settings });

        // Slugs recentes pra IA evitar repetição de tema
        const recentRows = await sbFetch('blog_posts?order=created_at.desc&limit=40&select=slug');
        const existingSlugs = (recentRows || []).map((r) => r.slug);

        const article = await callGemini({
            model,
            prompt: buildArticlePrompt({ topic, settings, existingSlugs }),
            responseSchema: RESPONSE_SCHEMA,
        });

        const clean = validateArticle(article);
        const slug = await ensureUniqueSlug(article.slug || slugify(article.title));
        const category = normalizeCategory(article, topic);
        const publishNow = settings.auto_publish !== false;

        const inserted = await sbFetch('blog_posts', {
            method: 'POST',
            body: {
                title: String(article.title).slice(0, 300),
                slug,
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

        await logGeneration({
            trigger_source: triggerSource,
            topic_id: topic.id,
            post_id: postId,
            status: 'success',
            detail: `"${post.title}" (${clean.words} palavras, status: ${post.status})`,
            model,
            duration_ms: Date.now() - started,
        });

        return { post, topic, words: clean.words };
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
