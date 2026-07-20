/**
 * Post-build SSG: gera HTML estático para cada post do blog (template v2).
 * Roda após `vite build` e cria dist/{slug}/index.html com conteúdo real.
 *
 * Benefícios SEO:
 * - Googlebot vê conteúdo, title, meta tags sem executar JS
 * - Social sharing (WhatsApp, Facebook) funciona com OG tags reais
 * - Structured data (JSON-LD Article) presente no HTML
 *
 * Também gera dist/llms.txt (llmstxt.org) com páginas principais + posts recentes.
 *
 * IMPORTANTE: os marcadores abaixo (ids/comentários) precisam existir no
 * blog-post.html. Cada replace valida se casou — se o template mudar sem
 * atualizar este script, o build acusa erro em vez de gerar página quebrada.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { renderPost, escapeHtml, formatDateBR as formatDate } from '../api/_lib/post-renderer.js';

const DIST = resolve(import.meta.dirname, '..', 'dist');
const POSTS_DIR = join(DIST, 'blog', 'posts');
const SITE_URL = 'https://almeidaematos.com.br';

// Ler template (blog-post.html buildado pelo Vite)
const template = readFileSync(join(DIST, 'blog-post.html'), 'utf-8');

// Ler posts-data.json
const postsData = JSON.parse(readFileSync(join(POSTS_DIR, 'posts-data.json'), 'utf-8'));

let generated = 0;
let errors = 0;

for (const postMeta of postsData) {
    try {
        const postFile = join(POSTS_DIR, `${postMeta.slug}.json`);
        if (!existsSync(postFile)) continue;

        const post = { ...postMeta, ...JSON.parse(readFileSync(postFile, 'utf-8')) };
        if (!post.author) post.author = 'Equipe Almeida & Matos';
        if (!post.readTime) {
            const wordCount = (post.content || '').replace(/<[^>]+>/g, '').split(/\s+/).length;
            post.readTime = Math.max(1, Math.ceil(wordCount / 200)) + ' min';
        }

        const html = renderPost(template, {
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt,
            category: post.category,
            date: post.date,
            modified: post.modified || post.dateModified || post.updated || null,
            author: post.author,
            readTime: post.readTime,
            content: post.content,
        });

        // Escrever dist/{slug}/index.html
        const outDir = join(DIST, post.slug);
        mkdirSync(outDir, { recursive: true });
        writeFileSync(join(outDir, 'index.html'), html, 'utf-8');
        generated++;
    } catch (e) {
        console.error(`Erro em ${postMeta.slug}: ${e.message}`);
        errors++;
    }
}

console.log(`SSG: ${generated} posts gerados, ${errors} erros`);
if (errors > 0) {
    // Falha o build (deploy não sai) — perder páginas legadas silenciosamente
    // seria desindexação em massa do principal ativo de SEO.
    console.error(`SSG FALHOU: ${errors} post(s) com erro — build abortado para proteger as URLs legadas.`);
    process.exitCode = 1;
}

// posts-preview.json — os 12 mais recentes (a home busca este arquivo em vez
// dos ~257KB do posts-data.json completo)
try {
    const preview = [...postsData]
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
        .slice(0, 12);
    writeFileSync(join(DIST, 'blog', 'posts', 'posts-preview.json'), JSON.stringify(preview), 'utf-8');
    console.log('posts-preview.json gerado (12 posts)');
} catch (e) {
    console.warn('posts-preview.json não gerado:', e.message);
}

// ============================================================
// llms.txt (llmstxt.org) — páginas principais + posts recentes
// ============================================================
try {
    const recentPosts = [...postsData]
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
        .slice(0, 30);

    const mainPages = [
        ['Início', '/', 'Apresentação do escritório, áreas de atuação, como funciona o atendimento e canais de contato.'],
        ['Benefícios (hub)', '/beneficios/', 'Central com todos os benefícios e direitos em que o escritório atua, com guia de cada um.'],
        ['Auxílio-Acidente', '/beneficios/auxilio-acidente/', 'Indenização mensal do INSS para quem ficou com sequela permanente após acidente — mesmo continuando a trabalhar.'],
        ['Auxílio-Doença', '/beneficios/auxilio-doenca/', 'Benefício por incapacidade temporária para o segurado que precisa se afastar do trabalho por doença ou acidente.'],
        ['BPC/LOAS', '/beneficios/bpc-loas/', 'Benefício assistencial de um salário mínimo para idosos 65+ e pessoas com deficiência em situação de baixa renda.'],
        ['Aposentadoria por Invalidez', '/beneficios/aposentadoria-por-invalidez/', 'Benefício por incapacidade permanente para quem não pode mais exercer atividade de trabalho.'],
        ['Pensão por Morte', '/beneficios/pensao-por-morte/', 'Benefício pago aos dependentes do segurado do INSS que faleceu.'],
        ['Aposentadoria PCD', '/beneficios/aposentadoria-pcd/', 'Aposentadoria com regras e prazos diferenciados para pessoas com deficiência.'],
        ['Indenização Cível e Trabalhista', '/beneficios/indenizacao-civel-trabalhista/', 'Reparação por acidentes com responsabilidade de terceiros ou do empregador: seguros, danos morais e materiais.'],
        ['Blog', '/blog/', 'Artigos educativos sobre direito acidentário, previdenciário e trabalhista.'],
    ];

    const llms = [
        '# Almeida & Matos Advogados',
        '',
        '> Escritório de advocacia fundado em 2015, em Barueri (SP), especialista em direito acidentário e previdenciário: auxílio-acidente, benefícios por incapacidade do INSS, BPC/LOAS, pensão por morte e indenizações. Mais de 11 anos de atuação e 10.000+ clientes atendidos em todo o Brasil. Contato: WhatsApp (11) 93004-4411.',
        '',
        '## Páginas principais',
        '',
        ...mainPages.map(([name, path, desc]) => `- [${name}](${SITE_URL}${path}): ${desc}`),
        '',
        '## Blog',
        '',
        ...recentPosts.map((p) => `- [${p.title}](${SITE_URL}/${p.slug}/)`),
        '',
    ].join('\n');

    writeFileSync(join(DIST, 'llms.txt'), llms, 'utf-8');
    console.log(`llms.txt gerado (${mainPages.length} páginas + ${recentPosts.length} posts)`);
} catch (e) {
    console.error(`Erro ao gerar llms.txt: ${e.message}`);
}
