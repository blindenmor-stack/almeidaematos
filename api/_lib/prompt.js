// ============================================================================
// Prompt de geração de artigo — saída JSON estruturada (Gemini/Claude/GPT)
// Monta o prompt a partir das settings (linha editorial) + pauta.
// Regras de estilo (STYLE_RULES) são compartilhadas com o passe de revisão
// (buildReviewPrompt) e espelhadas no lint determinístico (style-lint.js).
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

/**
 * Regras de estilo do Bernardo (skills/copy/escrita-sem-cara-de-ia.md),
 * adaptadas ao blog jurídico. Texto único usado na geração e na revisão.
 */
export const STYLE_RULES = `# ESTILO DE ESCRITA (obrigatório: artigo sério, sem cara de texto gerado por IA)
Referência de tom: reportagem de serviço de um jornal sério, escrita por um advogado experiente explicando um direito para um amigo no café. Confiante, calmo, concreto.

## Proibido (o texto é reprovado se contiver)
1. Antítese "não é X, é Y" e todas as variantes: "não é X, mas sim Y", "não é só X, é Y", "o que importa não é X, e sim Y", "não apenas X, mas também Y", "mais do que X, Y", "X não é o problema, é a pista". Afirme o positivo. Em vez de "Não é o pino que garante o benefício, é a sequela", escreva "A perícia avalia a limitação que o pino deixou."
2. Travessão (—) ou meia-risca ( – ) em qualquer posição. Use ponto, vírgula, dois-pontos ou parênteses. Zero ocorrências.
3. Lista negativa em cadência: "sem X, sem Y", "não X, não Y", "nem X, nem Y".
4. Transições vazias e muletas: "Vale lembrar", "Vale ressaltar", "Vale destacar", "Vale reunir", "Vale a pena", "É importante destacar", "É importante lembrar", "Além disso", "Por fim", "Em resumo", "Ou seja", "Na prática", "Em outras palavras", "Isso significa que", "Importante:", "Atenção:", "Lembre-se". Comece a frase pelo assunto.
5. Floreios e clichês: "mais comum do que parece", "o que poucas pessoas sabem", "muita gente acha", "muitos trabalhadores se perguntam", "essa cena", "imagine", "cada caso é um caso", "de verdade", "justamente", "exatamente" e "realmente" como reforço, "sério" como adjetivo de direito, "direito real" (real é termo técnico de direito de propriedade).
6. Metacomentário: "neste artigo", "vamos entender", "a seguir", "como vimos", "veja abaixo".
7. Pares de adjetivos quando um basta ("claro e objetivo", "grave e permanente").
8. Repetição do mesmo fato. Cada informação aparece uma vez, no lugar mais forte. O FAQ responde de outro ângulo, curto, sem copiar frases do corpo.
9. Emoji, reticências, ponto de exclamação, palavras em CAIXA ALTA.
10. Citação inventada atribuída à equipe jurídica ou a qualquer pessoa. Nada de <blockquote>.
11. "pra", "a gente", "tá". Registro sempre formal simples: "para", "nós" só dentro de "nossa equipe".

## Título (title), meta_title e H2
- Caixa baixa normal: só a primeira letra e nomes próprios ou siglas em maiúscula. Certo: "Documentos para pedir auxílio-doença". Errado: "Documentos Para Pedir Auxílio-Doença".
- Título com até 65 caracteres, descritivo, na forma da pergunta que o leitor digita ou de uma afirmação de fato. Sem ano ("em 2026"), sem "checklist completo", "guia completo", "tudo sobre", "entenda", "veja", "descubra", "saiba", "o que você precisa saber", "isso pode indicar", "por que isso", "mesmo trabalhando" como gancho.
- No máximo um dois-pontos no título, e só se a segunda parte for informação ("Auxílio-acidente: quem tem direito e quanto paga"), nunca um gancho ("...: o que ninguém te conta").
- H2 = pergunta real que alguém buscaria ou frase descritiva do conteúdo. Nunca "Introdução", "Conclusão", "Considerações finais".
- Estrutura sob medida: entre 3 e 6 H2 antes do FAQ, escolhidos pelo que o tema pede. Não repita o mesmo esqueleto de sempre ("O que é", "Quem tem direito", "Como comprovar", "Não é só o INSS"). A seção sobre outros direitos cumuláveis só entra quando o tema envolver de fato mais de um direito.

## Frases e parágrafos
- Frases curtas: média de 20 palavras, máximo 30. Uma ideia por frase.
- Parágrafos de 1 a 3 frases.
- Voz ativa com sujeito claro: "o INSS paga", "o perito avalia", "você entrega". Evite "é feito", "é realizado", "pode ser considerado", "deve ser apresentado".
- "Você" no centro. "Nossa equipe" no máximo 2 vezes no artigo inteiro, só no fechamento.
- Negrito (<strong>) em no máximo um trecho por parágrafo, sempre no fato, número ou prazo, nunca em frase inteira. No FAQ, negrito só na resposta direta ("<strong>Não.</strong>").
- Números, prazos e nomes de lei antes de adjetivos: "50% do salário de benefício" vale mais do que "um valor significativo".
- Nome oficial atual do benefício uma vez, entre parênteses, na primeira menção: auxílio-doença (auxílio por incapacidade temporária), aposentadoria por invalidez (aposentadoria por incapacidade permanente). Depois use o nome popular.
- Uma frase citável por seção: autocontida, com até 25 palavras, que faz sentido lida fora do contexto.

## Abertura e fechamento
- A primeira frase já é a resposta. Nunca abrir com "Você sabia", "Muitos trabalhadores", "Essa cena", "É comum que".
- Fechamento em 2 ou 3 frases com o próximo passo prático (o que reunir, onde pedir, o que conferir) e um convite discreto para tirar dúvidas pelo WhatsApp do escritório. Sem "esperamos que", sem "conclusão", sem "não hesite".

## Links internos
- De 1 a 3 links para páginas /beneficios/ e só quando o benefício fizer parte do assunto. Nunca insira uma menção a um benefício apenas para caber um link. Âncora = nome do benefício ou frase descritiva, nunca "clique aqui" ou "saiba mais".

## FAQ
- 4 a 6 perguntas que o leitor digitaria no Google. Respostas de 1 a 3 frases, começando pela resposta direta.`;

/** responseSchema do artigo — força a saída no shape exato que o sistema espera. */
export const RESPONSE_SCHEMA = {
    type: 'OBJECT',
    properties: {
        title: { type: 'STRING', description: 'Título do artigo (H1) em caixa baixa normal, até 65 caracteres, descritivo' },
        slug: { type: 'STRING', description: 'Slug URL: minúsculas, sem acento, hífens (ex: auxilio-acidente-para-quem-voltou-a-trabalhar)' },
        excerpt: { type: 'STRING', description: 'Resumo de 1-2 frases (máx 200 caracteres) que responde a dúvida principal' },
        meta_title: { type: 'STRING', description: 'Title tag SEO, máximo 60 caracteres, caixa baixa normal' },
        meta_description: { type: 'STRING', description: 'Meta description SEO, máximo 155 caracteres' },
        category: { type: 'STRING', description: 'Nome exato de uma das categorias permitidas' },
        category_slug: { type: 'STRING', description: 'Slug exato da categoria escolhida' },
        target_keyword: { type: 'STRING', description: 'Palavra-chave principal do artigo' },
        content_html: { type: 'STRING', description: 'Corpo do artigo em HTML semântico (h2, h3, p, ul, ol, table, strong, a). SEM h1, SEM blockquote, SEM style inline, SEM markdown.' },
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
 * @param {string[]} [params.recentTitles] - títulos recentes p/ variar estrutura e evitar repetição
 */
export function buildArticlePrompt({ topic, settings, existingSlugs = [], recentTitles = [] }) {
    const categoriesList = CATEGORIES.map((c) => `- "${c.name}" (slug: ${c.slug})`).join('\n');
    const productsList = PRODUCT_PAGES.map((p) => `- /beneficios/${p.slug}/ — ${p.label}`).join('\n');

    return `Você é um advogado brasileiro experiente em direito previdenciário e acidentário, escrevendo para o blog do escritório Almeida & Matos Advogados (almeidaematos.com.br). Seu leitor é um trabalhador comum que sofreu um acidente ou tem uma condição de saúde e quer entender seus direitos. Ele não conhece termos jurídicos.

# PAUTA
Tema do artigo: ${topic.topic}
${topic.target_keyword ? `Palavra-chave alvo: ${topic.target_keyword}` : ''}
${topic.category ? `Categoria sugerida: ${topic.category} (${topic.category_slug})` : ''}
${topic.product_slug ? `Página de produto relacionada (linkar se fizer parte do assunto): /beneficios/${topic.product_slug}/` : ''}
${topic.notes ? `Observações da pauta: ${topic.notes}` : ''}

# LINHA EDITORIAL
${settings.editorial_line || 'Blog educativo sobre direito previdenciário e acidentário, com prioridade para auxílio-acidente.'}

# TOM DE VOZ
${settings.tone || 'Advogado experiente: simples, direto, calmo. Fala com "você". Explica qualquer termo técnico na primeira vez que aparece.'}
${settings.extra_instructions ? `\n# INSTRUÇÕES EXTRAS DO EDITOR\n${settings.extra_instructions}` : ''}

${STYLE_RULES}

# REGRAS EDITORIAIS (OBRIGATÓRIAS)

## Compliance OAB (inegociável)
- NUNCA prometa resultado ("você vai ganhar", "garantimos"). Direitos dependem de análise do caso.
- NUNCA use urgência artificial ("ligue já", "últimas vagas", "não perca tempo").
- NUNCA cite valores de honorários, valores de causas ou casos concretos do escritório. Situações hipotéticas genéricas são permitidas.
- Tom educativo: o artigo ensina; a decisão é do leitor.

## AEO/SEO (resposta primeiro, otimizado para citação por IAs de busca)
- O PRIMEIRO parágrafo responde a pergunta principal do tema diretamente, em 40 a 60 palavras, de forma autocontida (faz sentido lido isolado).
- Logo abaixo de CADA H2, comece com 1 ou 2 frases que respondem aquela pergunta, antes de aprofundar. Cada seção funciona como um trecho citável independente.
- A primeira menção do conceito central é uma definição explícita em frase completa ("Auxílio-acidente é...").
- Use listas (ul/ol) e tabelas HTML quando ajudarem a escanear a informação (valores, prazos, requisitos, comparações). Lista com no máximo 7 itens.
- Fundamente afirmações legais citando a norma COM link para a fonte oficial: <a href="https://www.planalto.gov.br/ccivil_03/leis/l8213cons.htm">Lei 8.213/91</a>, Lei 8.742/93 (LOAS), LC 142/2013, Decreto 3.048/99 etc.
- Só apresente um dado numérico quando tiver CERTEZA de que é oficial e público (salário mínimo vigente, 50% do auxílio-acidente definido em lei, idade mínima do BPC), sempre com a fonte nomeada ("segundo a Lei 8.213/91...", "conforme regra do INSS...").
- Termine com uma seção <h2>Perguntas frequentes</h2> contendo as MESMAS perguntas/respostas do campo faq (em h3 + p).
- PROIBIDO inventar: estatísticas, percentuais de êxito, decisões judiciais específicas, números de processos ou prazos que não sejam de lei conhecida. Se não tem certeza, não afirme. Precisão vale mais que persuasão: este é conteúdo YMYL (saúde, dinheiro, direito).

## Linkagem interna
- Páginas de produto disponíveis:
${productsList}
- No fechamento, mencione que o leitor pode tirar dúvidas pelo WhatsApp do escritório, sem tom de venda. NÃO insira o link do WhatsApp; o template da página já adiciona o botão.

## Formato do content_html
- HTML semântico limpo: h2, h3, p, ul, ol, li, table, thead, tbody, tr, th, td, strong, em, a.
- SEM h1 (o template da página já coloca), SEM blockquote, SEM atributos style, SEM classes, SEM markdown, SEM comentários HTML.
- Extensão: de 700 a 1.200 palavras. O necessário para responder de verdade. Nada de encher.

## Categoria
Escolha exatamente UMA destas categorias (name e slug devem bater):
${categoriesList}

${recentTitles.length ? `## Artigos recentes do blog (não repita o tema nem a estrutura de seções deles)\n${recentTitles.slice(0, 20).map((t) => `- ${t}`).join('\n')}` : ''}
${existingSlugs.length ? `\n## Slugs já existentes (NÃO repita nenhum destes)\n${existingSlugs.slice(0, 40).map((s) => `- ${s}`).join('\n')}` : ''}

# SAÍDA
Responda APENAS com o JSON no schema fornecido. Antes de entregar, releia o artigo inteiro procurando travessões, antíteses "não é X, é Y", muletas da lista e título em Title Case. Corrija tudo antes de responder.`;
}

/** responseSchema do passe de revisão (mesmos campos textuais do artigo). */
export const REVIEW_SCHEMA = {
    type: 'OBJECT',
    properties: {
        title: { type: 'STRING', description: 'Título revisado (caixa baixa normal, até 65 caracteres)' },
        excerpt: { type: 'STRING', description: 'Resumo revisado (máx 200 caracteres)' },
        meta_title: { type: 'STRING', description: 'Title tag revisada (máx 60 caracteres)' },
        meta_description: { type: 'STRING', description: 'Meta description revisada (máx 155 caracteres)' },
        content_html: { type: 'STRING', description: 'Corpo revisado em HTML semântico, mesma estrutura de seções, sem blockquote' },
        faq: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: { question: { type: 'STRING' }, answer: { type: 'STRING' } },
                required: ['question', 'answer'],
            },
        },
        changes_summary: { type: 'STRING', description: 'Resumo em 1-3 frases do que foi alterado' },
    },
    required: ['title', 'excerpt', 'meta_title', 'meta_description', 'content_html', 'faq', 'changes_summary'],
};

/**
 * Prompt do passe de revisão de estilo. Recebe o artigo pronto + os problemas
 * apontados pelo lint e devolve o texto corrigido sem mexer no conteúdo jurídico.
 * @param {object} params
 * @param {object} params.article - {title, excerpt, meta_title, meta_description, content_html, faq}
 * @param {object} params.lint - resultado de lintArticle() (issues[])
 * @param {object} [params.settings] - blog_settings (tone, extra_instructions)
 */
export function buildReviewPrompt({ article, lint, settings = {} }) {
    const issues = (lint?.issues || [])
        .map((i) => `- ${i.label} (${i.count}×)${i.samples?.length ? `: ${i.samples.map((s) => `"${s}"`).join(' · ')}` : ''}`)
        .join('\n');

    return `Você é o revisor de estilo do blog do escritório Almeida & Matos Advogados. Recebe um artigo já escrito por outro redator e a lista de problemas encontrados por um verificador automático. Sua tarefa é reescrever apenas o necessário para o texto cumprir o ESTILO abaixo.

MANTENHA sem alteração: os fatos, as leis citadas e seus links (<a href>), os links internos para /beneficios/, a ordem e a quantidade das seções (h2/h3), tabelas e listas, o HTML semântico, e a extensão (pode encolher até 20%, nunca crescer). NÃO acrescente informação jurídica nova. NÃO invente dados.

CORRIJA: título, meta_title, excerpt, meta_description, corpo (content_html) e FAQ. O meta_title conta como título para todas as regras (nada de "Veja", "Entenda", Title Case). Remova qualquer <blockquote> convertendo a ideia em um parágrafo comum sem atribuição, ou apague se for redundante. Quando houver "Perguntas frequentes" no corpo, mantenha as respostas iguais às do campo faq.

${settings.tone ? `# TOM DE VOZ\n${settings.tone}\n` : ''}${settings.extra_instructions ? `# INSTRUÇÕES EXTRAS DO EDITOR\n${settings.extra_instructions}\n` : ''}
${STYLE_RULES}

# PROBLEMAS ENCONTRADOS PELO VERIFICADOR
${issues || '- (nenhum problema automático; revise mesmo assim contra o ESTILO)'}

# ARTIGO ATUAL
[title]
${article.title || ''}

[meta_title] (segue as mesmas regras do título: caixa baixa normal, sem "veja/entenda/saiba", até 60 caracteres)
${article.meta_title || ''}

[excerpt]
${article.excerpt || ''}

[meta_description]
${article.meta_description || ''}

[content_html] (HTML; devolva HTML com quebras de linha reais, nunca a sequência de dois caracteres barra-n)
${article.content_html || ''}

[faq] (JSON)
${JSON.stringify(article.faq || [])}

# SAÍDA
Responda APENAS com o JSON no schema fornecido. Antes de entregar, confira: zero travessões, zero "não é X, é Y", zero muletas da lista, título em caixa baixa normal, nenhum blockquote.`;
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

${recentTitles.length ? `Artigos recentes (NÃO repita esses temas nem variações deles):\n${recentTitles.slice(0, 30).map((t) => `- ${t}`).join('\n')}` : ''}

Sugira UMA pauta nova de artigo que responda uma dúvida real e frequente do público (trabalhadores acidentados, pessoas com incapacidade, famílias de baixa renda). Dê prioridade a temas de auxílio-acidente. O título da pauta deve ser a pergunta que a pessoa digitaria no Google, em caixa baixa normal, sem ano, sem "guia completo", sem travessão. Responda APENAS com o JSON no schema fornecido.`;
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

/**
 * Prompt do filtro de duplicidade: a pauta escolhida repete um artigo já publicado?
 * Usado antes de gerar (cron) pra não sair o mesmo tema com outro título.
 */
export function buildDuplicateCheckPrompt({ topic, recentTitles = [] }) {
    return `Você é o editor do blog do escritório Almeida & Matos Advogados. Avalie se a PAUTA abaixo repete o tema central de algum ARTIGO JÁ PUBLICADO. Considere duplicata quando o leitor que já leu o artigo publicado não aprenderia nada novo (mesma dúvida principal, mesmo benefício, mesma situação), mesmo que o título esteja escrito de outro jeito. Ângulos diferentes sobre o mesmo benefício NÃO são duplicata (ex.: "quanto paga" e "como recorrer da negativa" são artigos distintos).

PAUTA: ${topic.topic}
${topic.notes ? `Observações: ${String(topic.notes).slice(0, 400)}` : ''}

ARTIGOS JÁ PUBLICADOS:
${recentTitles.map((t) => `- ${t}`).join('\n')}

Responda APENAS com o JSON no schema fornecido.`;
}

export const DUPLICATE_CHECK_SCHEMA = {
    type: 'OBJECT',
    properties: {
        duplicate: { type: 'BOOLEAN', description: 'true se a pauta repete um artigo publicado' },
        similar_title: { type: 'STRING', description: 'Título do artigo publicado mais parecido (ou vazio)' },
        reason: { type: 'STRING', description: 'Justificativa em 1 frase' },
    },
    required: ['duplicate', 'similar_title', 'reason'],
};
