// ============================================================================
// Helper PostgREST (Supabase) — schema `aquisicao`
// Sem SDK: fetch global (Node 18+). Env: SUPABASE_URL + SUPABASE_SECRET_KEY.
// ============================================================================

const SCHEMA = 'aquisicao';

function baseHeaders(isWrite) {
    const key = process.env.SUPABASE_SECRET_KEY;
    return {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        // PostgREST: schema não-public via Accept-Profile (leitura) / Content-Profile (escrita)
        ...(isWrite ? { 'Content-Profile': SCHEMA } : { 'Accept-Profile': SCHEMA }),
    };
}

/**
 * Chamada genérica ao PostgREST.
 * @param {string} path - ex: 'blog_posts?status=eq.published&order=published_at.desc'
 * @param {object} [opts] - {method, body, headers}
 * @returns {Promise<any>} JSON parseado (ou null p/ 204)
 */
export async function sbFetch(path, opts = {}) {
    const url = process.env.SUPABASE_URL;
    if (!url || !process.env.SUPABASE_SECRET_KEY) {
        throw new Error('SUPABASE_URL / SUPABASE_SECRET_KEY não configuradas');
    }

    const method = opts.method || 'GET';
    const isWrite = method !== 'GET' && method !== 'HEAD';

    const res = await fetch(`${url}/rest/v1/${path}`, {
        method,
        headers: {
            ...baseHeaders(isWrite),
            // return=representation: PostgREST devolve as linhas afetadas na escrita
            ...(isWrite ? { Prefer: 'return=representation' } : {}),
            ...(opts.headers || {}),
        },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Supabase ${method} ${path} → ${res.status}: ${text.slice(0, 500)}`);
    }

    if (res.status === 204) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
}

/** Busca as settings do blog (singleton id=1). Retorna defaults se não existir. */
export async function getSettings() {
    const rows = await sbFetch('blog_settings?id=eq.1&limit=1');
    if (rows && rows.length) return rows[0];
    return {
        id: 1, enabled: true, posts_per_week: 3, publish_days: [1, 3, 5],
        publish_hour: 7, auto_publish: true, editorial_line: null, tone: null,
        extra_instructions: null, model: 'gemini-2.5-flash',
    };
}

/** Insere uma linha no log de geração (nunca lança — log não pode quebrar o fluxo). */
export async function logGeneration(entry) {
    try {
        await sbFetch('blog_generation_log', { method: 'POST', body: entry });
    } catch (e) {
        console.error('Falha ao gravar generation_log:', e.message);
    }
}
