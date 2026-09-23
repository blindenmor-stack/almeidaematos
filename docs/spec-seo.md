# Spec SEO/GEO — páginas Escritório e Contato

Data: 2026-09-23 · Baseado em `docs/brainstorm-paginas-escritorio-contato.md` (respeita R01-R08, DB1-DB6) · Skill: `skills/strategy/geo-specialist.md`

> **Nota de estado (23/09):** parte do plumbing da seção 6 já apareceu aplicada no repo (working tree, não commitada) enquanto esta spec era escrita — provavelmente a etapa E2/E5 rodando em paralelo. Cada item da seção 6 diz **✅ já aplicado** ou **⬜ pendente** conforme o estado observado agora. Confirme antes do commit.

## 1. Intenção de busca e termos-alvo

Sem dados do Search Console (P05). Base: GA4 90 dias (quase 100% Google orgânico, 3 sessões via ChatGPT) + os textos antigos (o que já pode estar ranqueando). Intenção das duas é **navegacional/de marca + local**: quem já ouviu falar do escritório busca confirmar identidade, endereço e um jeito de falar — não é busca informacional tipo "o que é auxílio-acidente".

**`/advocacia-sao-paulo/` — página Escritório**
- Primário: `Almeida & Matos Advogados` (marca) / `escritório de advocacia` (genérico que o slug carrega)
- Secundários: `advocacia São Paulo`, `escritório de advocacia Alphaville Barueri`, `advogados acidente e INSS São Paulo`, `quem somos Almeida & Matos`
- Termos do texto antigo a preservar: **"O Escritório"**, **"quem somos"**, **"escritório de advocacia"**, **"sócio-fundador"**, **"Felipe de Brito Almeida"**, **"Fellipe Moreira Matos"**, **"OAB/SP 338.615"**, **"OAB/SP 345.432"**, "conheça nossos profissionais" (usar variação "conheça os sócios")

**`/contato-advogado-sao-paulo/` — página Contato**
- Primário: `contato Almeida & Matos Advogados` / `fale com a equipe`
- Secundários: `advogado São Paulo contato`, `WhatsApp advogado acidente INSS`, `endereço escritório advocacia Alphaville Barueri`
- Termos do texto antigo a preservar: **"Entre em contato"**, **"Endereço"**, **"Atendimento"**, **"Telefone"**, **"E-mail"**, **"Fale com nossa equipe"**

"São Paulo" continua aparecendo com honestidade: o escritório fica em Alphaville, Barueri, região metropolitana de São Paulo, e atende todo o Brasil pelo WhatsApp — nunca afirmar sede na capital. Nenhum volume de busca foi inventado; os termos acima vêm só do texto que já existe e do GA4.

## 2. Head de cada página

### `/advocacia-sao-paulo/`

| Campo | Valor |
|---|---|
| `<title>` | `O Escritório \| Almeida & Matos Advogados` (40 car.) |
| meta description | `Escritório de advocacia fundado em 2015 em Alphaville, Barueri (SP). Sócios, áreas de atuação e atendimento pelo WhatsApp em todo o Brasil.` (139 car.) |
| H1 | `O escritório Almeida & Matos Advogados` (eyebrow: "Quem somos") |
| canonical | `https://almeidaematos.com.br/advocacia-sao-paulo/` |
| `og:type` | `website` (hoje é `article` — corrigir, C02) |
| `og:title` / `og:description` | mesmos do title/description |
| `og:image` | `https://almeidaematos.com.br/img/og-cover.jpg` |
| Twitter | `summary_large_image` |
| `robots` | `index, follow` |

Outline H2/H3 (copy finaliza a redação, mantém termos e estrutura):
- H2 Quem somos (fundação 2015, Alphaville, 70+ profissionais — número já publicado na home, atendimento em todo o Brasil pelo WhatsApp)
- H2 Áreas em que atuamos → H3 por benefício (Auxílio-acidente, Auxílio-doença, BPC/LOAS, Aposentadoria por invalidez, Pensão por morte, Aposentadoria PCD, Indenização cível e trabalhista) — cada H3 linka pro respectivo `/beneficios/*/`
- H2 Os sócios → H3 Felipe de Brito Almeida (OAB/SP 338.615) · H3 Fellipe Moreira Matos (OAB/SP 345.432)
- H2 Como trabalhamos (WhatsApp, conferência de documentos, processo eletrônico)
- H2 O escritório em Alphaville (fotos reais)
- H2 Perguntas frequentes (FAQ, 5 perguntas — seção 3)
- H2 Fale com a equipe (CTA final)

### `/contato-advogado-sao-paulo/`

| Campo | Valor |
|---|---|
| `<title>` | `Contato \| Almeida & Matos Advogados` (35 car.) |
| meta description | `Contato da Almeida & Matos Advogados: WhatsApp, e-mail e endereço em Alphaville, Barueri (SP). Veja como falar com a equipe.` (124 car.) |
| H1 | `Contato da Almeida & Matos Advogados` (eyebrow: "Fale com a equipe") |
| canonical | `https://almeidaematos.com.br/contato-advogado-sao-paulo/` |
| `og:type` | `website` |
| `og:title` / `og:description` | mesmos do title/description |
| `og:image` | `https://almeidaematos.com.br/img/og-cover.jpg` |
| Twitter | `summary_large_image` |
| `robots` | `index, follow` |

Outline H2:
- H2 Como falar com a gente (WhatsApp como canal principal, CTA grande)
- H2 Endereço (Alphaville, foto da recepção, link "como chegar" pro Maps)
- H2 O que acontece depois que você manda mensagem (3 passos)
- H2 Atendemos todo o Brasil (reforça que não precisa vir ao escritório)
- H2 Perguntas frequentes (FAQ, 5 perguntas — seção 3)
- H2 Fale com a equipe (CTA final)

Sem formulário (DB6). Telefone fixo fica de fora até confirmar (DB1/P02) — só WhatsApp e e-mail.

## 3. JSON-LD (pronto para colar no `<head>`, dentro de `<script type="application/ld+json">`)

`@graph` reaproveita o `@id` `#org` já publicado na home/benefícios (mesmo endereço e telefone, sem `openingHours` até confirmação — DB1). `AboutPage`/`ContactPage` referenciam `#org` via `mainEntity`. Os dois sócios usam o mesmo `@id` nas duas páginas (âncora canônica na página do Escritório), do mesmo jeito que o site já reusa `#org` — reforça a mesma entidade em todo o site (bom pra GEO, seção 7). Respostas do FAQ são provisórias e curtas; copy finaliza a redação sem tirar o padrão pergunta-resposta.

### `/advocacia-sao-paulo/`

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "LegalService",
      "@id": "https://almeidaematos.com.br/#org",
      "name": "Almeida & Matos Advogados",
      "url": "https://almeidaematos.com.br",
      "telephone": "+5511930044411",
      "logo": "https://almeidaematos.com.br/img/logo-am-oficial.webp",
      "address": { "@type": "PostalAddress", "streetAddress": "Alameda Araguaia, 1142 - Bloco 3, 1º andar", "addressLocality": "Barueri", "addressRegion": "SP", "postalCode": "06455-000", "addressCountry": "BR" },
      "employee": [
        { "@id": "https://almeidaematos.com.br/advocacia-sao-paulo/#felipe-almeida" },
        { "@id": "https://almeidaematos.com.br/advocacia-sao-paulo/#fellipe-matos" }
      ]
    },
    { "@type": "Person", "@id": "https://almeidaematos.com.br/advocacia-sao-paulo/#felipe-almeida", "name": "Felipe de Brito Almeida", "jobTitle": "Sócio-fundador", "worksFor": { "@id": "https://almeidaematos.com.br/#org" } },
    { "@type": "Person", "@id": "https://almeidaematos.com.br/advocacia-sao-paulo/#fellipe-matos", "name": "Fellipe Moreira Matos", "jobTitle": "Sócio-fundador", "worksFor": { "@id": "https://almeidaematos.com.br/#org" } },
    {
      "@type": "AboutPage",
      "@id": "https://almeidaematos.com.br/advocacia-sao-paulo/#webpage",
      "url": "https://almeidaematos.com.br/advocacia-sao-paulo/",
      "name": "O Escritório | Almeida & Matos Advogados",
      "description": "Escritório de advocacia fundado em 2015 em Alphaville, Barueri (SP). Sócios, áreas de atuação e atendimento pelo WhatsApp em todo o Brasil.",
      "mainEntity": { "@id": "https://almeidaematos.com.br/#org" },
      "breadcrumb": { "@id": "https://almeidaematos.com.br/advocacia-sao-paulo/#breadcrumb" },
      "inLanguage": "pt-BR"
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://almeidaematos.com.br/advocacia-sao-paulo/#breadcrumb",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Início", "item": "https://almeidaematos.com.br/" },
        { "@type": "ListItem", "position": 2, "name": "O Escritório", "item": "https://almeidaematos.com.br/advocacia-sao-paulo/" }
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        { "@type": "Question", "name": "A Almeida & Matos atende clientes em qualquer estado do Brasil?", "acceptedAnswer": { "@type": "Answer", "text": "Sim. O atendimento é pelo WhatsApp e o processo é eletrônico, então não depende de onde você mora." } },
        { "@type": "Question", "name": "Preciso ir até o escritório em Alphaville para ser atendido?", "acceptedAnswer": { "@type": "Answer", "text": "Não. O atendimento é à distância; a visita ao escritório é só quando necessário." } },
        { "@type": "Question", "name": "Desde quando a Almeida & Matos existe?", "acceptedAnswer": { "@type": "Answer", "text": "O escritório foi fundado em 2015 por Felipe de Brito Almeida e Fellipe Moreira Matos." } },
        { "@type": "Question", "name": "Em quais áreas do direito o escritório atua?", "acceptedAnswer": { "@type": "Answer", "text": "Acidentes, benefícios do INSS, indenizações e seguros: auxílio-acidente, auxílio-doença, BPC/LOAS, aposentadoria por invalidez, pensão por morte, aposentadoria PCD e indenização cível e trabalhista." } },
        { "@type": "Question", "name": "Como falo com um advogado da Almeida & Matos?", "acceptedAnswer": { "@type": "Answer", "text": "Pelo WhatsApp (11) 93004-4411. A equipe responde e orienta os próximos passos." } }
      ]
    }
  ]
}
```

### `/contato-advogado-sao-paulo/`

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "LegalService",
      "@id": "https://almeidaematos.com.br/#org",
      "name": "Almeida & Matos Advogados",
      "url": "https://almeidaematos.com.br",
      "telephone": "+5511930044411",
      "logo": "https://almeidaematos.com.br/img/logo-am-oficial.webp",
      "address": { "@type": "PostalAddress", "streetAddress": "Alameda Araguaia, 1142 - Bloco 3, 1º andar", "addressLocality": "Barueri", "addressRegion": "SP", "postalCode": "06455-000", "addressCountry": "BR" }
    },
    { "@type": "Person", "@id": "https://almeidaematos.com.br/advocacia-sao-paulo/#felipe-almeida", "name": "Felipe de Brito Almeida", "jobTitle": "Sócio-fundador", "worksFor": { "@id": "https://almeidaematos.com.br/#org" } },
    { "@type": "Person", "@id": "https://almeidaematos.com.br/advocacia-sao-paulo/#fellipe-matos", "name": "Fellipe Moreira Matos", "jobTitle": "Sócio-fundador", "worksFor": { "@id": "https://almeidaematos.com.br/#org" } },
    {
      "@type": "ContactPage",
      "@id": "https://almeidaematos.com.br/contato-advogado-sao-paulo/#webpage",
      "url": "https://almeidaematos.com.br/contato-advogado-sao-paulo/",
      "name": "Contato | Almeida & Matos Advogados",
      "description": "Contato da Almeida & Matos Advogados: WhatsApp, e-mail e endereço em Alphaville, Barueri (SP). Veja como falar com a equipe.",
      "mainEntity": { "@id": "https://almeidaematos.com.br/#org" },
      "breadcrumb": { "@id": "https://almeidaematos.com.br/contato-advogado-sao-paulo/#breadcrumb" },
      "inLanguage": "pt-BR"
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://almeidaematos.com.br/contato-advogado-sao-paulo/#breadcrumb",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Início", "item": "https://almeidaematos.com.br/" },
        { "@type": "ListItem", "position": 2, "name": "Contato", "item": "https://almeidaematos.com.br/contato-advogado-sao-paulo/" }
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        { "@type": "Question", "name": "Qual o horário de atendimento da Almeida & Matos?", "acceptedAnswer": { "@type": "Answer", "text": "Segunda a sexta, das 9h às 18h, pelo WhatsApp." } },
        { "@type": "Question", "name": "Preciso agendar para ir ao escritório em Alphaville?", "acceptedAnswer": { "@type": "Answer", "text": "A maior parte do atendimento é resolvida pelo WhatsApp, sem visita. Quando é necessário ir ao escritório, combine antes com a equipe." } },
        { "@type": "Question", "name": "Qual o endereço do escritório?", "acceptedAnswer": { "@type": "Answer", "text": "Alameda Araguaia, 1142, Bloco 3, 1º andar, Alphaville Industrial, Barueri (SP), CEP 06455-000." } },
        { "@type": "Question", "name": "A Almeida & Matos atende quem não mora em Barueri ou São Paulo?", "acceptedAnswer": { "@type": "Answer", "text": "Sim. O atendimento é em todo o Brasil pelo WhatsApp, sem precisar viajar até o escritório." } },
        { "@type": "Question", "name": "O que acontece depois que eu mando mensagem no WhatsApp?", "acceptedAnswer": { "@type": "Answer", "text": "A equipe responde, faz perguntas sobre o seu caso e explica os próximos passos." } }
      ]
    }
  ]
}
```

Nada de `AggregateRating`, `Review` ou qualquer schema de promessa/resultado — compliance OAB (R04).

## 4. Plano de links internos

**De onde as 12 páginas linkam PARA as duas novas** (hoje é zero, C09):

| Local | Mudança | Arquivos |
|---|---|---|
| Nav "Escritório" das páginas internas | `<a href="/#escritorio">Escritório</a>` (2x por arquivo: desktop + mobile) → `<a href="/advocacia-sao-paulo/">Escritório</a>` | blog/index.html, blog-post.html, beneficios/index.html + 7 páginas de benefício, politica-de-privacidade/index.html (11 arquivos × 2 ocorrências) |
| Nav da home | Mantém `#escritorio` (âncora) — home já mostra a seção inline (DB3 default) | index.html — sem mudança |
| Seção `#escritorio` da home | Adicionar botão "Conheça o escritório em detalhes" apontando pra `/advocacia-sao-paulo/`, ao lado do botão do YouTube já existente | index.html, linha ~478 |
| Rodapé, coluna "Contato" | Adicionar 2 itens: `<li><a href="/advocacia-sao-paulo/">O Escritório</a></li>` e `<li><a href="/contato-advogado-sao-paulo/">Fale conosco</a></li>` | os 12 arquivos com `footer__grid` |
| CTA final das 7 páginas de benefício | Link secundário "Conheça o escritório" abaixo do botão de WhatsApp, texto-âncora "Conheça o escritório" → `/advocacia-sao-paulo/` | 7 páginas de `beneficios/*/index.html` |

**De onde as duas páginas linkam PARA fora:**

| Página | Destino | Texto-âncora |
|---|---|---|
| Escritório | 7 páginas de benefício (H3 "Áreas em que atuamos") | nome de cada benefício, ex. "Auxílio-acidente" |
| Escritório | `/contato-advogado-sao-paulo/` (CTA final) | "Fale com a equipe" |
| Escritório | `/blog/` (seção "quem somos" ou rodapé) | "Ver os artigos do blog" |
| Escritório | `/politica-de-privacidade/` (rodapé, padrão do site) | "Política de Privacidade" |
| Contato | `/advocacia-sao-paulo/` (seção "quem somos", link de volta) | "Conheça o escritório" |
| Contato | 7 páginas de benefício (opcional, na seção "atendemos todo o Brasil", como exemplo de área) | nomes dos benefícios |
| Contato | `/politica-de-privacidade/` (rodapé, padrão do site) | "Política de Privacidade" |

## 5. Imagens

Ativos já processados em `img/escritorio/` (16 fotos, `-800.webp` mobile e `-1600.webp` desktop, `README.md` com origem no Drive) — usar esses, não buscar novos.

- **Nome de arquivo:** já em kebab-case descritivo (`recepcao-sofa-wide-1600.webp`) — manter.
- **Alt:** descritivo e específico, nunca "foto do escritório" genérico. Ex.: `alt="Recepção da Almeida & Matos em Alphaville, Barueri (SP)"`, `alt="Equipe da Almeida & Matos em reunião no escritório"`. Nunca nomear colaborador específico (DB2: fotos de ambiente/grupo, sem close individual).
- **Dimensões:** `width`/`height` fixos no `<img>` (1600×1067 e 800×533 aprox., conferir proporção real de cada arquivo antes de codar) para não gerar layout shift.
- **`<picture>` com `srcset`:**
```html
<picture>
  <source srcset="/img/escritorio/recepcao-sofa-wide-1600.webp" media="(min-width: 768px)">
  <img src="/img/escritorio/recepcao-sofa-wide-800.webp" alt="Recepção da Almeida & Matos em Alphaville, Barueri (SP)" width="1600" height="1067" loading="lazy">
</picture>
```
- **Hero:** a foto do hero (ex. `recepcao-logo-sofa` ou `equipe-grupo-2025`) leva `fetchpriority="high"` e **sem** `loading="lazy"` (é a LCP da página); todas as outras, `loading="lazy"`.
- Sócios: `felipe-almeida.webp` e `fellipe-matos.webp` já existem em `img/` — usar na seção "Os sócios", `alt="Felipe de Brito Almeida, sócio-fundador da Almeida & Matos, OAB/SP 338.615"` (idem Fellipe Matos).
- Nenhum arquivo deve passar de 120 KB no mobile — os `-800.webp` atuais já atendem (27 a 61 KB).

## 6. Checklist de preservação da indexação

**(a) Remover os dois slugs de `posts-data.json` (duas cópias)** — ✅ já aplicado. `public/blog/posts/posts-data.json` (491→489 entradas) e `blog/posts/posts-data.json` (29→27) não têm mais `advocacia-sao-paulo` nem `contato-advogado-sao-paulo`; os `.json` individuais dos dois posts também foram apagados dos dois diretórios. Conferir com:
```bash
grep -c "advocacia-sao-paulo\|contato-advogado-sao-paulo" public/blog/posts/posts-data.json blog/posts/posts-data.json  # deve dar 0 nos dois
```

**(b) Manter em `legacy-slugs.js`** — ✅ já está lá (protege contra um post novo do banco colidir com o slug). Não remover essa entrada mesmo com a página fora do JSON de posts.

**(c) Adicionar as duas URLs na lista fixa de `api/blog/sitemap.js`** — ✅ já aplicado:
```diff
 const STATIC_LASTMOD = '2026-07-01';
+// lastmod das páginas Escritório e Contato (recriadas fora do blog)
+const INSTITUTIONAL_LASTMOD = '2026-09-23';
@@
         for (const slug of PRODUCT_SLUGS) {
             entries.push(urlEntry(`${SITE_URL}/beneficios/${slug}/`, STATIC_LASTMOD, '0.9'));
         }
+        // Páginas institucionais (estáticas desde 09/2026; antes eram posts legados do blog)
+        entries.push(urlEntry(`${SITE_URL}/advocacia-sao-paulo/`, INSTITUTIONAL_LASTMOD, '0.8'));
+        entries.push(urlEntry(`${SITE_URL}/contato-advogado-sao-paulo/`, INSTITUTIONAL_LASTMOD, '0.8'));
```
Prioridade 0.8 (mesmo nível do `/blog/`, abaixo da home e dos benefícios). Atualizar `INSTITUTIONAL_LASTMOD` quando o conteúdo mudar de verdade.

**(d) Adicionar no array de páginas principais do `llms.txt` (`generate-posts.js`)** — ✅ já aplicado:
```diff
         ['Indenização Cível e Trabalhista', '/beneficios/indenizacao-civel-trabalhista/', '...'],
+        ['O escritório', '/advocacia-sao-paulo/', 'Quem é a Almeida & Matos: fundada em 2015 em Alphaville (Barueri, SP), sócios, áreas de atuação, como o atendimento funciona e fotos do escritório.'],
+        ['Contato', '/contato-advogado-sao-paulo/', 'Canais oficiais de contato: WhatsApp, e-mail e endereço do escritório em Alphaville, Barueri (SP). Atendimento em todo o Brasil.'],
         ['Blog', '/blog/', 'Artigos educativos sobre direito acidentário, previdenciário e trabalhista.'],
```

**Pendente, fora da lista a-e mas necessário pra buildar:** `vite.config.js` ainda não tem `advocacia-sao-paulo/index.html` nem `contato-advogado-sao-paulo/index.html` no `rollupOptions.input` — sem isso o Vite não processa (nem injeta Clarity/Manychat) as páginas novas. Adicionar junto da etapa E3/E4.

**(e) Search Console após o deploy:**
1. Inspecionar as duas URLs (`Inspeção de URL`) e clicar em **"Solicitar indexação"** assim que o deploy estiver no ar.
2. Reenviar `sitemap.xml` (geralmente não precisa — é dinâmico — mas force um recrawl se o Google não pegar em 48h).
3. Comparar em D+7 e D+30 as impressões/cliques das duas URLs contra a baseline atual (72 e 34 sessões orgânicas/90 dias, GA4) — queda sustentada é o sinal de alerta do pré-mortem #1 do brainstorm.
4. Checar na aba "Cobertura"/"Páginas" se o Google reclassificou a URL de `article` pra outro tipo de página (esperado, já que `og:type` muda pra `website`).

## 7. GEO — citabilidade por ChatGPT/Gemini/Perplexity

`robots.txt` já libera `OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot`, `Claude-SearchBot`, `Claude-User`, `GPTBot`, `ClaudeBot`, `Google-Extended` — nenhuma mudança necessária aí. GA4 já mostra 3 sessões via ChatGPT nos 90 dias: pouco volume, mas prova que motores generativos já indexam o site.

- **Resposta primeiro:** primeiro parágrafo de cada página (o `answer-box` do template) responde em 40-60 palavras, sem preâmbulo — "A Almeida & Matos é um escritório de advocacia fundado em 2015, em Alphaville, Barueri (SP)..." / "Fale com a Almeida & Matos pelo WhatsApp (11) 93004-4411..."
- **Dados NAP em texto puro** (não só na imagem do mapa nem só no schema): endereço completo, telefone e e-mail escritos no HTML visível, idênticos ao JSON-LD e à home — é o sinal de entidade mais forte pra RAG.
- **FAQ espelhada 1:1** entre o `<details>` visível e o `FAQPage` da seção 3 — já é o padrão do site.
- **Entidade consistente:** mesmo `@id` `#org` da home reaproveitado (seção 3), mesmo `@id` de Person para os sócios reusado nas duas páginas — reforça pro motor que é a mesma entidade em todo o domínio.
- **Blocos citáveis:** pelo menos uma frase autocontida por H2 (ex. "O atendimento é pelo WhatsApp, em todo o Brasil; o pedido no INSS e o processo na Justiça são eletrônicos.") — frase que funciona sozinha, fora de contexto, como resposta.
- Sem keyword stuffing, sem estatística inventada (auxílio-acidente/skill seção 2: keyword stuffing é a única tática que piora citação, -8% a -10%).

## 8. Checklist pós-deploy

```bash
curl -sI https://almeidaematos.com.br/advocacia-sao-paulo/ | grep -Ei "^(HTTP|location|x-vercel-cache)"
curl -sI https://almeidaematos.com.br/contato-advogado-sao-paulo/ | grep -Ei "^(HTTP|location|x-vercel-cache)"
curl -s https://almeidaematos.com.br/advocacia-sao-paulo/ | grep -o 'canonical[^>]*'
curl -s https://almeidaematos.com.br/sitemap.xml | grep -E "advocacia-sao-paulo|contato-advogado-sao-paulo"
grep -r "Voltar para o blog" dist/advocacia-sao-paulo/index.html dist/contato-advogado-sao-paulo/index.html  # tem que falhar (0 matches)
```

- [ ] `curl -I` das duas URLs: `200`, sem `location` de redirect
- [ ] Canonical no HTML bate com a URL real (sem barra dupla, sem `www`)
- [ ] `x-vercel-cache: MISS` no primeiro request após o deploy, `HIT` no segundo (cache invalidou)
- [ ] `/sitemap.xml` em produção lista as duas URLs com `lastmod` novo
- [ ] Rich Results Test (search.google.com/test/rich-results) nas duas URLs: `LegalService`, `AboutPage`/`ContactPage`, `BreadcrumbList`, `FAQPage`, `Person` × 2 sem erro
- [ ] `og:image` carrega (testar no debugger do Facebook/WhatsApp)
- [ ] Lighthouse mobile ≥ 90 nas duas páginas (LCP da foto do hero é o risco principal — seção 5)
- [ ] Nenhuma imagem 404 (todas as fotos do hero/seções vêm de `img/escritorio/` ou `img/felipe-almeida.webp`/`img/fellipe-matos.webp`)
- [ ] Passo (e) da seção 6: pedir reindexação no Search Console
