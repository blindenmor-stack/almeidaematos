// ============================================================================
// Prompt de geração de artigo — Gemini (saída JSON estruturada)
// Monta o prompt a partir das settings (linha editorial) + pauta.
// ============================================================================

/** Categorias válidas do blog (mesmas do acervo de 491 posts). */
export const CATEGORIES = [
    { name: 'Auxílio Acidente', slug: 'auxilio-acidente' },
    { name: 'BPC LOAS', slug: 'bpc-loas' },
    { name: 'Benefícios INSS', slug: 'beneficios-inss' },
    { name: 'Aposentadoria Especial', slug: 'aposentadoria-especial' },
];

/** Páginas de produto disponíveis pra linkagem interna. */
export const PRODUCT_PAGES = [
    { slug: 'auxilio-acidente', label: 'Auxílio-acidente' },
    { slug: 'auxilio-doenca', label: 'Auxílio-doença' },
    { slug: 'bpc-loas', label: 'BPC/LOAS' },
    { slug: 'aposentadoria-por-invalidez', label: 'Aposentadoria por invalidez' },
    { slug: 'pensao-por-morte', label: 'Pensão por morte' },
    { slug: 'aposentadoria-pcd', label: 'Aposentadoria da pessoa com deficiência (PCD)' },
    { slug: 'indenizacao-civel-trabalhista', label: 'Indenização cível e trabalhista' },
];

/** responseSchema do Gemini — força a saída no shape exato que o sistema espera. */
export const RESPONSE_SCHEMA = {
    type: 'OBJECT',
    properties: {
        title: { type: 'STRING', description: 'Título do artigo (H1), claro e específico' },
        slug: { type: 'STRING', description: 'Slug URL: minúsculas, sem acento, hífens (ex: auxilio-acidente-para-quem-voltou-a-trabalhar)' },
        excerpt: { type: 'STRING', description: 'Resumo de 1-2 frases (máx 200 caracteres) que responde a dúvida principal' },
        meta_title: { type: 'STRING', description: 'Title tag SEO, máximo 60 caracteres' },
        meta_description: { type: 'STRING', description: 'Meta description SEO, máximo 155 caracteres' },
        category: { type: 'STRING', description: 'Nome exato de uma das categorias permitidas' },
        category_slug: { type: 'STRING', description: 'Slug exato da categoria escolhida' },
        target_keyword: { type: 'STRING', description: 'Palavra-chave principal do artigo' },
        content_html: { type: 'STRING', description: 'Corpo do artigo em HTML semântico (h2, h3, p, ul, ol, table, strong). SEM h1, SEM style inline, SEM markdown.' },
        faq: {
            type: 'ARRAY',
            description: '4 a 6 perguntas frequentes com respostas curtas e diretas',
            items: {
                type: 'OBJECT',
                properties: {
                    question: { type: 'STRING' },
                    answer: { type: 'STRING' },
                },
                required: ['question', 'answer'],
            },
        },
        read_time: { type: 'STRING', description: 'Tempo de leitura estimado, ex: "6 min"' },
    },
    required: [
        'title', 'slug', 'excerpt', 'meta_title', 'meta_description',
        'category', 'category_slug', 'target_keyword', 'content_html', 'faq', 'read_time',
    ],
};

/**
 * Monta o prompt do artigo.
 * @param {object} params
 * @param {object} params.topic - pauta {topic, target_keyword, category, category_slug, product_slug, notes}
 * @param {object} params.settings - blog_settings (editorial_line, tone, extra_instructions)
 * @param {string[]} [params.existingSlugs] - slugs recentes p/ evitar colisão/duplicidade de tema
 */
export function buildArticlePrompt({ topic, settings, existingSlugs = [] }) {
    const categoriesList = CATEGORIES.map((c) => `- "${c.name}" (slug: ${c.slug})`).join('\n');
    const productsList = PRODUCT_PAGES.map((p) => `- /beneficios/${p.slug}/ — ${p.label}`).join('\n');

    return `Você é um advogado-educador brasileiro especialista em direito previdenciário e acidentário, escrevendo para o blog do escritório Almeida & Matos Advogados (almeidaematos.com.br). Seu leitor é um trabalhador comum que sofreu um acidente ou tem uma condição de saúde e quer entender seus direitos — ele NÃO conhece termos jurídicos.

# PAUTA
Tema do artigo: ${topic.topic}
${topic.target_keyword ? `Palavra-chave alvo: ${topic.target_keyword}` : ''}
${topic.category ? `Categoria sugerida: ${topic.category} (${topic.category_slug})` : ''}
${topic.product_slug ? `Página de produto relacionada (linkar obrigatoriamente): /beneficios/${topic.product_slug}/` : ''}
${topic.notes ? `Observações da pauta: ${topic.notes}` : ''}

# LINHA EDITORIAL
${settings.editorial_line || 'Blog educativo sobre direito previdenciário e acidentário, com prioridade para auxílio-acidente.'}

# TOM DE VOZ
${settings.tone || 'Advogado-educador: simples, direto, empático. Fala com "você". Explica qualquer termo técnico na primeira vez que aparece.'}
${settings.extra_instructions ? `\n# INSTRUÇÕES EXTRAS DO EDITOR\n${settings.extra_instructions}` : ''}

# REGRAS EDITORIAIS (OBRIGATÓRIAS)

## Compliance OAB (inegociável)
- NUNCA prometa resultado ("você vai ganhar", "garantimos") — direitos dependem de análise do caso.
- NUNCA use urgência artificial ("ligue já", "últimas vagas", "não perca tempo").
- NUNCA cite valores de honorários, valores de causas ou casos concretos do escritório.
- Tom educativo: o artigo ensina; a decisão é do leitor.

## AEO/SEO (answer-first)
- O PRIMEIRO parágrafo responde a pergunta principal do tema DIRETAMENTE, em até 3 frases. Sem rodeios, sem "neste artigo vamos ver".
- H2s formulados como perguntas quando soar natural (ex: "Quem tem direito ao auxílio-acidente?").
- Use listas (ul/ol) e tabelas HTML quando ajudarem a escanear a informação.
- Inclua definições claras dos termos técnicos.
- Termine com uma seção <h2>Perguntas frequentes</h2> contendo as MESMAS perguntas/respostas do campo faq (em h3 + p).
- Fundamente afirmações legais citando a norma: Lei 8.213/91, Lei 8.742/93 (LOAS), LC 142/2013, Decreto 3.048/99 etc.
- PROIBIDO inventar: estatísticas, percentuais de êxito, decisões judiciais específicas, números de processos ou prazos que não sejam de lei conhecida. Se não tem certeza, não afirme.

## Linkagem interna
- Inclua 2 a 3 links contextuais (tag <a>) para páginas de produto relevantes, escolhendo entre:
${productsList}
- Os links devem aparecer naturalmente no meio do texto (âncora descritiva, nunca "clique aqui").
- No último parágrafo antes do FAQ, mencione discretamente que o leitor pode tirar dúvidas pelo WhatsApp do escritório (sem tom de venda) — NÃO insira o link do WhatsApp, o template da página já adiciona o botão.

## Formato do content_html
- HTML semântico limpo: h2, h3, p, ul, ol, li, table, thead, tbody, tr, th, td, strong, em, a.
- SEM h1 (o template da página já coloca), SEM atributos style, SEM classes, SEM markdown, SEM comentários HTML.
- Extensão: 900 a 1400 palavras.

## Categoria
Escolha exatamente UMA destas categorias (name e slug devem bater):
${categoriesList}

${existingSlugs.length ? `## Slugs já existentes (NÃO repita nenhum destes)\n${existingSlugs.slice(0, 40).map((s) => `- ${s}`).join('\n')}` : ''}

# SAÍDA
Responda APENAS com o JSON no schema fornecido. O campo faq deve ter de 4 a 6 itens com respostas de 2-4 frases.`;
}

/**
 * Prompt pra gerar uma pauta nova quando a fila de blog_topics está vazia.
 */
export function buildTopicPrompt({ settings, recentTitles = [] }) {
    const productsList = PRODUCT_PAGES.map((p) => `- ${p.slug}: ${p.label}`).join('\n');
    return `Você é o editor-chefe do blog do escritório Almeida & Matos Advogados (direito previdenciário e acidentário no Brasil).

Linha editorial: ${settings.editorial_line || 'Blog educativo sobre benefícios do INSS e direitos de quem sofreu acidente, com prioridade para auxílio-acidente.'}

Produtos do escritório (o artigo deve se conectar a um deles):
${productsList}

${recentTitles.length ? `Artigos recentes (NÃO repita esses temas):\n${recentTitles.slice(0, 30).map((t) => `- ${t}`).join('\n')}` : ''}

Sugira UMA pauta nova de artigo que responda uma dúvida real e frequente do público (trabalhadores acidentados, pessoas com incapacidade, famílias de baixa renda). Dê prioridade a temas de auxílio-acidente. Responda APENAS com o JSON no schema fornecido.`;
}

/** responseSchema da geração de pauta. */
export const TOPIC_RESPONSE_SCHEMA = {
    type: 'OBJECT',
    properties: {
        topic: { type: 'STRING', description: 'Título da pauta (a dúvida a responder)' },
        target_keyword: { type: 'STRING' },
        category: { type: 'STRING' },
        category_slug: { type: 'STRING' },
        product_slug: { type: 'STRING', description: 'Slug do produto relacionado (ex: auxilio-acidente)' },
    },
    required: ['topic', 'target_keyword', 'category', 'category_slug', 'product_slug'],
};
