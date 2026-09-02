#!/usr/bin/env node
// ============================================================================
// CLI local do blog A&M — fila de pautas, lint de estilo, preview e reescrita
// do acervo. Roda na máquina do Bernardo com as credenciais locais
// (~/.claude/mcp-credentials); nunca commita chave.
//
//   node scripts/blog.mjs topics [--status pending|used|discarded|all]
//   node scripts/blog.mjs topics add pautas.txt [--dry-run] [--force] [--priority 7]
//   node scripts/blog.mjs topics discard <id> [<id>...]
//   node scripts/blog.mjs topics restore <id>
//   node scripts/blog.mjs topics priority <id> <n>
//   node scripts/blog.mjs topics retitle <id> "novo título"
//   node scripts/blog.mjs lint [--all | --slug s | --limit n]
//   node scripts/blog.mjs preview <topic-id> | --text "pauta livre" [--out dir] [--model m] [--no-review]
//   node scripts/blog.mjs rewrite [--all | --slug s | --limit n] [--apply] [--out dir] [--concurrency 2]
//
// Formato do arquivo de pautas (uma por linha, campos separados por " | ",
// só o título é obrigatório; linhas com # são ignoradas):
//   Título da pauta | palavra-chave | produto-slug | prioridade | observações
// Ou um JSON: [{ "topic", "target_keyword", "product_slug", "category_slug", "priority", "notes" }]
// ============================================================================

import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { homedir } from 'node:os';

const ROOT = resolve(import.meta.dirname, '..');
const CREDS_DIR = join(homedir(), '.claude', 'mcp-credentials');
const DEFAULT_OUT = join(ROOT, 'backups', 'preview');

// ----------------------------------------------------------------- env local
function readJson(path) {
    try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}
function loadLocalEnv() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
        const c = readJson(join(CREDS_DIR, 'supabase-crm-credentials.json'));
        if (c) {
            process.env.SUPABASE_URL ||= c.url;
            process.env.SUPABASE_SECRET_KEY ||= c.service_role_key;
        }
    }
    if (!process.env.ANTHROPIC_API_KEY) {
        const c = readJson(join(CREDS_DIR, 'anthropic-am.json'));
        if (c?.api_key) process.env.ANTHROPIC_API_KEY = c.api_key;
    }
    if (!process.env.OPENAI_API_KEY) {
        const c = readJson(join(CREDS_DIR, 'openai-am.json'));
        if (c?.api_key) process.env.OPENAI_API_KEY = c.api_key;
    }
    if (!process.env.GEMINI_API_KEY) {
        const c = readJson(join(ROOT, 'gemini-credentials.json')) || readJson(join(CREDS_DIR, 'gemini-credentials.json'));
        if (c?.api_key) process.env.GEMINI_API_KEY = c.api_key;
    }
}

// ----------------------------------------------------------------- args
function parseArgs(argv) {
    const flags = {};
    const pos = [];
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a.startsWith('--')) {
            const key = a.slice(2);
            const next = argv[i + 1];
            if (next !== undefined && !next.startsWith('--')) { flags[key] = next; i++; }
            else flags[key] = true;
        } else pos.push(a);
    }
    return { flags, pos };
}

const { flags, pos } = parseArgs(process.argv.slice(2));
const [cmd, sub, ...rest] = pos;

function die(msg) { console.error(`✖ ${msg}`); process.exit(1); }
function today() { return new Date().toISOString().slice(0, 10); }

// ----------------------------------------------------------------- helpers de texto
function htmlToMarkdown(html) {
    return String(html || '')
        .replace(/<h2[^>]*>(.*?)<\/h2>/gis, '\n\n## $1\n\n')
        .replace(/<h3[^>]*>(.*?)<\/h3>/gis, '\n\n### $1\n\n')
        .replace(/<li[^>]*>(.*?)<\/li>/gis, '- $1\n')
        .replace(/<tr[^>]*>(.*?)<\/tr>/gis, (_, row) => '| ' + row.replace(/<t[hd][^>]*>(.*?)<\/t[hd]>/gis, '$1 | ').trim() + '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<strong>(.*?)<\/strong>/gis, '**$1**')
        .replace(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gis, '[$2]($1)')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function articleToMarkdown(article, lint) {
    const faq = (article.faq || []).map((f) => `**${f.question}**\n${f.answer}`).join('\n\n');
    return [
        `# ${article.title}`,
        '',
        `> excerpt: ${article.excerpt || ''}`,
        `> meta_title: ${article.meta_title || ''}`,
        `> meta_description: ${article.meta_description || ''}`,
        lint ? `> lint: ${lint.hard} grave(s), ${lint.soft} aviso(s) — ${lint.summary}` : '',
        '',
        htmlToMarkdown(article.content_html),
        '',
        '## FAQ (campo faq)',
        '',
        faq,
        '',
    ].join('\n');
}

function printLint(label, lint) {
    const tag = lint.hard ? '🔴' : lint.soft >= 3 ? '🟡' : '🟢';
    console.log(`${tag} ${label}: ${lint.hard} grave(s), ${lint.soft} aviso(s) — ${lint.summary}`);
    for (const i of lint.issues) {
        console.log(`     ${i.severity === 'hard' ? '!' : '·'} ${i.label} ×${i.count}${i.samples.length ? `  ex.: ${i.samples.slice(0, 2).map((s) => `"${s}"`).join(' · ')}` : ''}`);
    }
}

// ----------------------------------------------------------------- comandos
async function cmdTopics(lib) {
    const { sbFetch } = lib.supabase;
    const action = sub && !sub.includes('-') ? sub : 'list';

    if (action === 'list') {
        const status = flags.status || 'pending';
        const filter = status === 'all' ? '' : `&status=eq.${status}`;
        const rows = await sbFetch(`blog_topics?select=id,topic,priority,status,source,product_slug,category_slug,created_at,used_at${filter}&order=status.asc,priority.desc,created_at.asc&limit=300`);
        console.log(`${rows.length} pauta(s) [${status}]\n`);
        rows.forEach((t, i) => {
            console.log(`${String(i + 1).padStart(2, '0')}. p${String(t.priority).padEnd(2)} ${(t.source || '-').padEnd(10)} ${t.status.padEnd(9)} ${t.topic}`);
            console.log(`    id=${t.id}  produto=${t.product_slug || '-'}  criada=${String(t.created_at).slice(0, 10)}`);
        });
        return;
    }

    if (action === 'add') {
        const file = rest[0];
        if (!file) die('informe o arquivo: topics add pautas.txt');
        const raw = readFileSync(resolve(file), 'utf8');
        let items;
        if (extname(file) === '.json') {
            items = JSON.parse(raw);
        } else {
            items = raw.split('\n')
                .map((l) => l.trim())
                .filter((l) => l && !l.startsWith('#'))
                .map((l) => {
                    const [topic, target_keyword, product_slug, priority, notes] = l.split('|').map((x) => x.trim());
                    return { topic, target_keyword, product_slug, priority: priority ? parseInt(priority, 10) : undefined, notes };
                });
        }
        const defaultPriority = flags.priority ? parseInt(flags.priority, 10) : 7;
        const { tokens, jaccard } = lib.contentlab;
        const { PRODUCT_PAGES, CATEGORIES } = lib.prompt;
        const [pending, posts] = await Promise.all([
            sbFetch('blog_topics?select=topic,status&status=in.(pending,used)&limit=500'),
            sbFetch('blog_posts?select=title&limit=500'),
        ]);
        const existing = [...pending.map((r) => ({ text: r.topic, kind: `pauta ${r.status}` })), ...posts.map((r) => ({ text: r.title, kind: 'post publicado' }))];
        const existingTok = existing.map((e) => ({ ...e, tok: tokens(e.text) }));

        let added = 0;
        for (const it of items) {
            if (!it.topic) continue;
            const tok = tokens(it.topic);
            const hit = existingTok.find((e) => jaccard(tok, e.tok) >= 0.45);
            if (hit && !flags.force) {
                console.log(`⚠ pulada (parece ${hit.kind}: "${hit.text}"): ${it.topic}`);
                continue;
            }
            if (it.product_slug && !PRODUCT_PAGES.some((p) => p.slug === it.product_slug)) die(`product_slug inválido: ${it.product_slug} (${PRODUCT_PAGES.map((p) => p.slug).join(', ')})`);
            const cat = it.category_slug ? CATEGORIES.find((c) => c.slug === it.category_slug) : null;
            const body = {
                topic: String(it.topic).slice(0, 500),
                target_keyword: it.target_keyword || null,
                product_slug: it.product_slug || null,
                category: cat?.name || null,
                category_slug: cat?.slug || null,
                priority: Number.isInteger(it.priority) ? it.priority : defaultPriority,
                status: 'pending',
                notes: it.notes || null,
                source: 'manual',
            };
            if (flags['dry-run']) { console.log(`· (dry-run) ${body.priority} ${body.topic}`); continue; }
            const [row] = await sbFetch('blog_topics', { method: 'POST', body });
            existingTok.push({ text: row.topic, kind: 'pauta pending', tok });
            console.log(`✔ p${row.priority} ${row.topic}  id=${row.id}`);
            added++;
        }
        console.log(`\n${added} pauta(s) inserida(s)${flags['dry-run'] ? ' (dry-run: nada gravado)' : ''}.`);
        return;
    }

    if (action === 'discard' || action === 'restore') {
        const ids = rest;
        if (!ids.length) die('informe o id');
        for (const id of ids) {
            const [row] = await sbFetch(`blog_topics?id=eq.${id}`, { method: 'PATCH', body: action === 'discard' ? { status: 'discarded' } : { status: 'pending', used_at: null } });
            console.log(`✔ ${row.status}: ${row.topic}`);
        }
        return;
    }

    if (action === 'priority') {
        const [id, n] = rest;
        const p = parseInt(n, 10);
        if (!id || !Number.isInteger(p)) die('uso: topics priority <id> <n>');
        const [row] = await sbFetch(`blog_topics?id=eq.${id}`, { method: 'PATCH', body: { priority: p } });
        console.log(`✔ p${row.priority}: ${row.topic}`);
        return;
    }

    if (action === 'retitle') {
        const [id, ...title] = rest;
        const topic = title.join(' ').trim();
        if (!id || !topic) die('uso: topics retitle <id> "novo título"');
        const [row] = await sbFetch(`blog_topics?id=eq.${id}`, { method: 'PATCH', body: { topic: topic.slice(0, 500) } });
        console.log(`✔ ${row.topic}`);
        return;
    }

    die(`ação desconhecida: ${action}`);
}

async function fetchPosts(lib) {
    const { sbFetch } = lib.supabase;
    const sel = 'id,title,slug,excerpt,meta_title,meta_description,content_html,faq,status,published_at,read_time';
    if (flags.slug) {
        const rows = await sbFetch(`blog_posts?select=${sel}&slug=eq.${encodeURIComponent(flags.slug)}&limit=1`);
        if (!rows.length) die(`post não encontrado: ${flags.slug}`);
        return rows;
    }
    const limit = flags.all ? 500 : parseInt(flags.limit || '5', 10);
    return sbFetch(`blog_posts?select=${sel}&status=eq.published&order=published_at.desc&limit=${limit}`);
}

async function cmdLint(lib) {
    const { lintArticle } = lib.lint;
    const posts = await fetchPosts(lib);
    let totHard = 0;
    let totSoft = 0;
    for (const p of posts) {
        const l = lintArticle(p);
        totHard += l.hard; totSoft += l.soft;
        const tag = l.hard ? '🔴' : l.soft >= 3 ? '🟡' : '🟢';
        console.log(`${tag} ${String(p.published_at).slice(0, 10)} ${p.title.slice(0, 72).padEnd(72)} graves=${l.hard} avisos=${l.soft}  ${l.summary}`);
    }
    console.log(`\n${posts.length} post(s): ${totHard} tique(s) grave(s), ${totSoft} aviso(s).`);
}

async function cmdPreview(lib) {
    const { sbFetch, getSettings } = lib.supabase;
    const { callLLM } = lib.llm;
    const { buildArticlePrompt, RESPONSE_SCHEMA } = lib.prompt;
    const { lintArticle } = lib.lint;
    const { polishArticle } = lib.generate;

    const settings = await getSettings();
    const model = flags.model || settings.model || 'gemini-pro-latest';
    let topic;
    if (flags.text) topic = { topic: String(flags.text) };
    else if (sub) {
        const rows = await sbFetch(`blog_topics?id=eq.${sub}&limit=1`);
        if (!rows.length) die(`pauta não encontrada: ${sub}`);
        topic = rows[0];
    } else die('uso: preview <topic-id> | --text "pauta"');

    const [recent, slugs] = await Promise.all([
        sbFetch('blog_posts?status=eq.published&order=published_at.desc&limit=40&select=title'),
        sbFetch('blog_posts?order=created_at.desc&limit=40&select=slug'),
    ]);
    console.log(`Gerando com ${model}: "${topic.topic}"\n`);
    const t0 = Date.now();
    const { result: draft } = await callLLM({
        model,
        prompt: buildArticlePrompt({ topic, settings, existingSlugs: slugs.map((r) => r.slug), recentTitles: recent.map((r) => r.title) }),
        responseSchema: RESPONSE_SCHEMA,
    });
    const lint0 = lintArticle(draft);
    printLint(`rascunho (${Math.round((Date.now() - t0) / 1000)}s)`, lint0);

    let final = { article: draft, lint: lint0, reviews: 0, history: [] };
    if (!flags['no-review']) {
        final = await polishArticle({ article: draft, settings, model, started: Date.now(), deadlineMs: 10 * 60_000 });
        printLint(`após ${final.reviews} revisão(ões) (${Math.round((Date.now() - t0) / 1000)}s total)`, final.lint);
        for (const h of final.history.slice(1)) console.log(`     passe ${h.pass}: ${h.changes}`);
    }

    const out = resolve(flags.out || DEFAULT_OUT);
    mkdirSync(out, { recursive: true });
    const base = join(out, `${today()}_${(final.article.slug || 'preview').slice(0, 60)}`);
    writeFileSync(`${base}.json`, JSON.stringify({ topic, model, draft, final: final.article, lint_before: lint0, lint_after: final.lint, history: final.history }, null, 2));
    writeFileSync(`${base}.md`, articleToMarkdown(final.article, final.lint));
    if (!flags['no-review']) writeFileSync(`${base}.rascunho.md`, articleToMarkdown(draft, lint0));
    console.log(`\nSalvo em ${base}.md (nada gravado no banco).`);
}

async function cmdRewrite(lib) {
    const { sbFetch, getSettings } = lib.supabase;
    const { lintArticle } = lib.lint;
    const { polishArticle, validateArticle } = lib.generate;

    const settings = await getSettings();
    const model = flags.model || settings.model || 'gemini-pro-latest';
    const apply = !!flags.apply;
    const posts = await fetchPosts(lib);
    const out = resolve(flags.out || DEFAULT_OUT);
    mkdirSync(out, { recursive: true });
    const backupFile = join(ROOT, 'backups', `blog_posts_${today()}.jsonl`);
    if (apply) mkdirSync(join(ROOT, 'backups'), { recursive: true });

    console.log(`${apply ? 'APLICANDO' : 'Dry-run'} em ${posts.length} post(s) com ${model}\n`);
    const concurrency = Math.max(1, parseInt(flags.concurrency || '2', 10));
    const queue = [...posts];
    const results = [];

    async function worker() {
        while (queue.length) {
            const p = queue.shift();
            const before = lintArticle(p);
            if (before.hard === 0 && before.soft < 3) {
                console.log(`🟢 já ok: ${p.title}`);
                results.push({ slug: p.slug, skipped: true });
                continue;
            }
            const t0 = Date.now();
            try {
                const { article, lint, reviews } = await polishArticle({ article: p, settings, model, started: Date.now(), deadlineMs: 10 * 60_000 });
                const secs = Math.round((Date.now() - t0) / 1000);
                const tag = lint.hard ? '🔴' : lint.soft >= 3 ? '🟡' : '🟢';
                console.log(`${tag} ${p.slug}\n     antes: ${before.hard} graves / ${before.soft} avisos (${before.summary})\n     depois: ${lint.hard} graves / ${lint.soft} avisos (${lint.summary}) — ${reviews} passe(s), ${secs}s`);
                if (article.title !== p.title) console.log(`     título: "${p.title}" → "${article.title}"`);

                const base = join(out, `${today()}_${p.slug.slice(0, 60)}`);
                writeFileSync(`${base}.antes.md`, articleToMarkdown(p, before));
                writeFileSync(`${base}.depois.md`, articleToMarkdown(article, lint));

                if (apply) {
                    appendFileSync(backupFile, JSON.stringify(p) + '\n');
                    const clean = validateArticle(article);
                    await sbFetch(`blog_posts?id=eq.${p.id}`, {
                        method: 'PATCH',
                        body: {
                            title: String(article.title).slice(0, 300),
                            excerpt: clean.excerpt,
                            meta_title: clean.metaTitle,
                            meta_description: clean.metaDescription,
                            content_html: clean.contentHtml,
                            faq: clean.faq,
                            read_time: clean.readTime,
                            updated_at: new Date().toISOString(),
                        },
                    });
                    console.log(`     ✔ gravado (backup em ${backupFile})`);
                }
                results.push({ slug: p.slug, before, after: lint, reviews });
            } catch (err) {
                console.log(`✖ ${p.slug}: ${err.message}`);
                results.push({ slug: p.slug, error: err.message });
            }
        }
    }
    await Promise.all(Array.from({ length: concurrency }, worker));

    const done = results.filter((r) => r.after);
    console.log(`\n${done.length} reescrito(s), ${results.filter((r) => r.skipped).length} já ok, ${results.filter((r) => r.error).length} erro(s).`);
    console.log(`Graves: ${done.reduce((n, r) => n + r.before.hard, 0)} → ${done.reduce((n, r) => n + r.after.hard, 0)} · avisos: ${done.reduce((n, r) => n + r.before.soft, 0)} → ${done.reduce((n, r) => n + r.after.soft, 0)}`);
    console.log(`Antes/depois em ${out}${apply ? '' : ' (dry-run: nada gravado no banco; use --apply)'}`);
}

// ----------------------------------------------------------------- main
(async () => {
    if (!cmd || flags.help) {
        console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 22).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
        process.exit(0);
    }
    loadLocalEnv();
    if (!process.env.SUPABASE_URL) die('SUPABASE_URL/SUPABASE_SECRET_KEY ausentes (env ou ~/.claude/mcp-credentials/supabase-crm-credentials.json)');
    const lib = {
        supabase: await import('../api/_lib/supabase.js'),
        prompt: await import('../api/_lib/prompt.js'),
        lint: await import('../api/_lib/style-lint.js'),
        llm: await import('../api/_lib/llm.js'),
        generate: await import('../api/_lib/generate.js'),
        contentlab: await import('../api/_lib/contentlab-sync.js'),
    };
    const handlers = { topics: cmdTopics, lint: cmdLint, preview: cmdPreview, rewrite: cmdRewrite };
    const fn = handlers[cmd];
    if (!fn) die(`comando desconhecido: ${cmd} (topics | lint | preview | rewrite)`);
    await fn(lib);
})().catch((err) => { console.error('✖', err.message); process.exit(1); });
