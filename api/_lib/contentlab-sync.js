// ============================================================================
// Sync ContentLab → blog_topics
// Importa assuntos densos do Content Lab (schema aquisicao, content_topics)
// como pautas do blog. Roda no cron diário, best-effort: falha aqui nunca
// pode derrubar a geração do post.
//
// Dedup em 2 camadas:
//   1. source_id (uuid do content_topic) — índice único parcial no banco
//   2. similaridade de título (Jaccard de tokens) contra pautas existentes,
//      pra não duplicar tema que já entrou na fila manualmente
// ============================================================================

import { sbFetch } from './supabase.js';
import { CATEGORIES, PRODUCT_PAGES } from './prompt.js';

const LOOKBACK_DAYS = 60;
const MAX_IMPORT_PER_RUN = 10;
const SIMILARITY_THRESHOLD = 0.45;

// Assuntos de perfil pessoal/branding não viram artigo de blog institucional
const EXCLUDE_RE = /bastidor|humaniza|branding|\bmatos\b|entretenimento|curiosidade pessoal/i;

/** minúsculas, sem acento, tokens com 4+ letras truncados em 5 chars
 *  (truncamento ~stemming: "recebi"/"recebeu" → "receb") */
function tokens(text) {
    return new Set(
        String(text || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter((t) => t.length >= 4)
            .map((t) => t.slice(0, 5))
    );
}

function jaccard(a, b) {
    if (!a.size || !b.size) return 0;
    let inter = 0;
    for (const t of a) if (b.has(t)) inter++;
    return inter / (a.size + b.size - inter);
}

/** Mapeia área jurídica + título do ContentLab pra uma categoria do blog. */
function inferCategory(topic) {
    const text = `${topic.area_juridica || ''} ${topic.titulo || ''}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '');
    if (/auxilio.acidente|acidente de trabalho|sequela|cat\b|trajeto/.test(text)) {
        return CATEGORIES.find((c) => c.slug === 'auxilio-acidente');
    }
    if (/bpc|loas/.test(text)) return CATEGORIES.find((c) => c.slug === 'bpc-loas');
    if (/aposentadoria (especial|pcd)|pessoa com deficiencia/.test(text)) {
        return CATEGORIES.find((c) => c.slug === 'aposentadoria-especial');
    }
    return CATEGORIES.find((c) => c.slug === 'beneficios-inss');
}

/** Sugere a página de produto pra linkagem obrigatória. */
function inferProductSlug(topic) {
    const text = `${topic.area_juridica || ''} ${topic.titulo || ''} ${topic.resumo_denso || ''}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '');
    const rules = [
        ['auxilio-acidente', /auxilio.acidente|sequela|acidente de trabalho|trajeto/],
        ['auxilio-doenca', /auxilio.doenca|afastamento|alta do inss|pericia/],
        ['bpc-loas', /bpc|loas/],
        ['pensao-por-morte', /pensao por morte|morte|fatal|familia do trabalhador/],
        ['aposentadoria-por-invalidez', /invalidez|incapacidade total/],
        ['aposentadoria-pcd', /pcd|pessoa com deficiencia/],
        ['indenizacao-civel-trabalhista', /indeniza|transito|civel|justa causa|fgts|empresa/],
    ];
    for (const [slug, re] of rules) {
        if (re.test(text) && PRODUCT_PAGES.some((p) => p.slug === slug)) return slug;
    }
    return 'auxilio-acidente';
}

/** Monta as notas da pauta com o material denso do ContentLab. */
function buildNotes(topic) {
    const parts = [
        'Pauta importada do Content Lab. Transforme o gancho em artigo educativo EVERGREEN — não noticie o caso específico nem cite pessoas envolvidas.',
    ];
    if (topic.resumo_denso) parts.push(`Contexto da pesquisa: ${String(topic.resumo_denso).slice(0, 1200)}`);
    const fatos = Array.isArray(topic.fatos) ? topic.fatos.slice(0, 5) : [];
    if (fatos.length) {
        parts.push(`Fatos apurados: ${fatos.map((f) => (typeof f === 'string' ? f : f?.fato || JSON.stringify(f))).join(' | ').slice(0, 800)}`);
    }
    if (topic.angulo) parts.push(`Ângulo sugerido: ${topic.angulo}`);
    if (topic.fonte_origem) parts.push(`Origem: ${topic.fonte_origem}`);
    return parts.join('\n\n').slice(0, 3000);
}

/**
 * Importa assuntos novos do ContentLab pra fila de pautas do blog.
 * @returns {Promise<{imported: number, skipped: number}>}
 */
export async function syncContentLabTopics() {
    const since = new Date(Date.now() - LOOKBACK_DAYS * 86400_000).toISOString();

    const [candidates, existing] = await Promise.all([
        sbFetch(
            `content_topics?potencial=in.(alto,medio)&created_at=gte.${encodeURIComponent(since)}` +
            `&select=id,titulo,resumo_denso,fatos,area_juridica,angulo,fonte_origem,potencial&order=created_at.desc&limit=100`
        ),
        sbFetch('blog_topics?select=topic,source_id&order=created_at.desc&limit=300'),
    ]);

    const known = new Set((existing || []).map((r) => r.source_id).filter(Boolean));
    const existingTokens = (existing || []).map((r) => tokens(r.topic));

    let imported = 0;
    let skipped = 0;

    for (const ct of candidates || []) {
        if (imported >= MAX_IMPORT_PER_RUN) break;
        if (known.has(ct.id)) continue;
        if (!ct.titulo || ct.titulo.length < 15) { skipped++; continue; }
        if (EXCLUDE_RE.test(`${ct.titulo} ${ct.area_juridica || ''}`)) { skipped++; continue; }

        const tks = tokens(ct.titulo);
        if (existingTokens.some((e) => jaccard(tks, e) >= SIMILARITY_THRESHOLD)) {
            skipped++;
            continue;
        }

        const category = inferCategory(ct);
        await sbFetch('blog_topics', {
            method: 'POST',
            body: {
                topic: String(ct.titulo).slice(0, 500),
                category: category.name,
                category_slug: category.slug,
                product_slug: inferProductSlug(ct),
                priority: ct.potencial === 'alto' ? 8 : 6,
                status: 'pending',
                notes: buildNotes(ct),
                source: 'contentlab',
                source_id: ct.id,
            },
        });
        existingTokens.push(tks);
        imported++;
    }

    return { imported, skipped };
}
