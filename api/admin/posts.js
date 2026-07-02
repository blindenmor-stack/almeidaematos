// ============================================================================
// /api/admin/posts — CRUD de posts (requer x-admin-password)
//   GET    ?limit=&offset=&status=&q=  — lista todos (qualquer status)
//   POST   — cria post manual
//   PATCH  ?id= — edita campos permitidos
//   DELETE ?id= — arquiva (status=archived; nunca deleta de verdade)
// ============================================================================

import { requireAdmin } from '../_lib/auth.js';
import { sbFetch } from '../_lib/supabase.js';
import {
    readJsonBody, sendError, SLUG_RE, slugify, sanitizeHtml, countWords,
} from '../_lib/util.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = ['draft', 'scheduled', 'published', 'archived'];

// Campos editáveis via PATCH/POST (whitelist — nada além disso passa)
const EDITABLE = [
    'title', 'slug', 'excerpt', 'content_html', 'category', 'category_slug',
    'author', 'read_time', 'status', 'meta_title', 'meta_description',
    'faq', 'internal_links', 'target_keyword', 'scheduled_for',
];

/** Valida/normaliza payload de escrita. Retorna objeto limpo ou lança. */
function cleanPayload(body, { isCreate }) {
    const out = {};
    for (const key of EDITABLE) {
        if (!(key in body)) continue;
        out[key] = body[key];
    }

    if (isCreate && !out.title) throw new Error('title é obrigatório');
    if (out.title !== undefined) {
        out.title = String(out.title).slice(0, 300);
        if (out.title.length < 5) throw new Error('Título muito curto');
    }
    if (isCreate && !out.slug && out.title) out.slug = slugify(out.title);
    if (out.slug !== undefined) {
        out.slug = String(out.slug).trim().toLowerCase();
        if (!SLUG_RE.test(out.slug) || out.slug.length > 200) {
            throw new Error('Slug inválido (use só minúsculas, números e hífens)');
        }
    }
    if (out.status !== undefined && !STATUSES.includes(out.status)) {
        throw new Error(`Status inválido (${STATUSES.join('|')})`);
    }
    if (out.content_html !== undefined) {
        out.content_html = sanitizeHtml(String(out.content_html).slice(0, 200000));
    }
    if (out.excerpt !== undefined) out.excerpt = String(out.excerpt).slice(0, 400);
    if (out.meta_title !== undefined) out.meta_title = String(out.meta_title).slice(0, 70);
    if (out.meta_description !== undefined) out.meta_description = String(out.meta_description).slice(0, 170);
    if (out.faq !== undefined) {
        if (!Array.isArray(out.faq)) throw new Error('faq deve ser um array de {question, answer}');
        out.faq = out.faq
            .filter((f) => f && f.question && f.answer)
            .map((f) => ({ question: String(f.question).slice(0, 300), answer: String(f.answer).slice(0, 1500) }))
            .slice(0, 10);
    }

    // read_time automático se tem conteúdo e não veio explícito
    if (out.content_html && out.read_time === undefined) {
        out.read_time = `${Math.max(1, Math.ceil(countWords(out.content_html) / 200))} min`;
    }

    return out;
}

export default async function handler(req, res) {
    try {
        if (!requireAdmin(req, res)) return;

        // ------------------------- GET: listar -------------------------
        if (req.method === 'GET') {
            // GET por id: retorna o registro COMPLETO (content_html, faq, etc.)
            const byId = String(req.query?.id || '');
            if (byId) {
                if (!UUID_RE.test(byId)) return sendError(res, 400, 'id inválido');
                const rows = await sbFetch(`blog_posts?id=eq.${byId}&limit=1`);
                if (!rows || !rows.length) return sendError(res, 404, 'Post não encontrado');
                return res.status(200).json(rows[0]);
            }

            const limit = Math.min(Math.max(parseInt(req.query?.limit, 10) || 50, 1), 200);
            const offset = Math.max(parseInt(req.query?.offset, 10) || 0, 0);
            const status = String(req.query?.status || '').trim();
            const q = String(req.query?.q || '').trim();

            let path = 'blog_posts?select=id,title,slug,excerpt,category,category_slug,status,origin,read_time,target_keyword,published_at,created_at,updated_at'
                + `&order=created_at.desc&limit=${limit}&offset=${offset}`;
            if (status) {
                if (!STATUSES.includes(status)) return sendError(res, 400, 'Status inválido');
                path += `&status=eq.${status}`;
            }
            if (q) {
                // Busca simples por título (ilike). * é o wildcard do PostgREST.
                path += `&title=ilike.${encodeURIComponent('*' + q.replace(/[*,()]/g, ' ').trim() + '*')}`;
            }

            const rows = await sbFetch(path, {
                headers: { Prefer: 'count=exact' },
            });
            return res.status(200).json(rows || []);
        }

        // ------------------------- POST: criar manual -------------------------
        if (req.method === 'POST') {
            const body = await readJsonBody(req);
            const payload = cleanPayload(body, { isCreate: true });
            payload.origin = 'manual';
            if (!payload.status) payload.status = 'draft';
            if (payload.status === 'published') payload.published_at = new Date().toISOString();

            const rows = await sbFetch('blog_posts', { method: 'POST', body: payload });
            return res.status(201).json(rows[0]);
        }

        // ------------------------- PATCH: editar -------------------------
        if (req.method === 'PATCH') {
            const id = String(req.query?.id || '');
            if (!UUID_RE.test(id)) return sendError(res, 400, 'id inválido');

            const body = await readJsonBody(req);
            const payload = cleanPayload(body, { isCreate: false });
            if (!Object.keys(payload).length) return sendError(res, 400, 'Nada para atualizar');

            // published_at: preserva o histórico — só seta na PRIMEIRA publicação;
            // editar um post publicado não muda a data, e despublicar não a apaga.
            if (payload.status === 'published') {
                const current = await sbFetch(`blog_posts?id=eq.${id}&select=published_at&limit=1`);
                if (!current || !current.length) return sendError(res, 404, 'Post não encontrado');
                if (!current[0].published_at) payload.published_at = new Date().toISOString();
            }

            const rows = await sbFetch(`blog_posts?id=eq.${id}`, { method: 'PATCH', body: payload });
            if (!rows || !rows.length) return sendError(res, 404, 'Post não encontrado');
            return res.status(200).json(rows[0]);
        }

        // ------------------------- DELETE: arquivar -------------------------
        if (req.method === 'DELETE') {
            const id = String(req.query?.id || '');
            if (!UUID_RE.test(id)) return sendError(res, 400, 'id inválido');

            // Soft delete: arquiva. Post publicado some do site mas fica no banco.
            const rows = await sbFetch(`blog_posts?id=eq.${id}`, {
                method: 'PATCH',
                body: { status: 'archived' },
            });
            if (!rows || !rows.length) return sendError(res, 404, 'Post não encontrado');
            return res.status(200).json(rows[0]);
        }

        return sendError(res, 405, 'Método não permitido');
    } catch (err) {
        console.error('api/admin/posts:', err);
        const isValidation = /obrigatório|inválid|curto|array/.test(err.message);
        return sendError(res, isValidation ? 400 : 500, err.message);
    }
}
