# Brainstorm: páginas Escritório e Contato fora do blog

Data: 2026-09-23 · Pedido: Bernardo · Site: almeidaematos.com.br (repo `site_principal`)

> **Propósito** Decidir como tirar `/advocacia-sao-paulo/` e `/contato-advogado-sao-paulo/` do template de artigo do blog e transformá-las em páginas institucionais próprias, sem perder a URL nem a indexação, melhorando SEO e conversão, com fotos reais do escritório.

## 🎯 0. Enquadramento

1. **Objetivo em uma frase:** quem busca o escritório no Google (marca, endereço, contato) cai numa página própria, no padrão v5 do site, que responde em segundos quem somos, onde estamos e como falar, e continua ranqueando nas mesmas URLs.
2. **Restrições duras:** URLs iguais às atuais (com barra final); stack Vite + Tailwind estático, deploy git → Vercel (main = produção, sem Vercel CLI); identidade v5 (Source Serif 4 + Plus Jakarta, papel/navy/dourado); compliance OAB (sem promessa de resultado, sem valores, sem "melhor"); uso de imagem de colaboradores (LGPD); NAP igual ao schema já publicado (Alameda Araguaia, 1142, Bloco 3, 1º andar, Barueri, CEP 06455-000); WhatsApp (11) 93004-4411 como canal; nada inventado (números só com fonte).
3. **Fora do escopo:** reescrever a home; páginas locais por cidade; redesenhar o blog; formulário com backend novo; auditoria do Google Business Profile (registrada como ideia).
4. **Fontes:** código do repo, páginas ao vivo, GA4 (property 404445930), pasta do Drive com 177 imagens, `CONTEXTO_MESTRE.md`, skills de copy/SEO/UX. **Falta:** consultas do Search Console (credencial sem escopo), telefone fixo atual, confirmação de autorização de imagem, bios atualizadas dos sócios.
5. **Quem decide:** Bernardo (escopo, textos, fotos, push em produção); sócios (o que dizer sobre eles); adm (telefone/horário).

## 📋 1. Inventário

### Demandas (D)

| ID | Demanda | Quem | Tipo | Citação |
|---|---|---|---|---|
| D01 | Recriar `/advocacia-sao-paulo/` como página do escritório no padrão do site | Bernardo | funcionalidade | "recriar essas páginas nos mesmos moldes" |
| D02 | Recriar `/contato-advogado-sao-paulo/` como página de contato | Bernardo | funcionalidade | idem |
| D03 | Não perder indexação (mesma URL, 200, sitemap) | Bernardo | regra | "sem perder a indexação" |
| D04 | Melhorar SEO on-page (title, description, H1, schema, links internos) | Bernardo | funcionalidade | "mantendo o SEO e até melhorando" |
| D05 | Usar imagens reais: sócio, escritório, equipe (pasta do Drive) | Bernardo | ajuste-ui | "imagem do sócio, do escritório... de background" |
| D06 | Páginas "super otimizadas" (performance + conversão) | Bernardo | funcionalidade | "deixar ela super otimizada" |
| D07 | Método: brainstorm, depois agentes de copy, SEO, UX/UI e webdesign | Bernardo | decisão | "ative os agentes especialistas" |

### Código e gargalos (C)

| ID | Fato (fonte) |
|---|---|
| C01 | As duas URLs são posts legados do WordPress em `public/blog/posts/posts-data.json` (491 posts, categoria "Geral"). O SSG `scripts/generate-posts.js` gera `dist/{slug}/index.html` com o template `blog-post.html`. Por isso parecem artigo: data, autor "Equipe", "Voltar para o blog", "Artigos relacionados". |
| C02 | Title está aceitável ("O Escritório \| Almeida & Matos Advogados", "Contato \| ..."), mas a meta description é texto cru em caixa alta ("O ESCRITÓRIO o escritório quem somos...") e `og:type` é `article`. Sem breadcrumb, sem schema de organização. |
| C03 | Todas as imagens apontam para `/wp-content/uploads/...`, que o `vercel.json` redireciona 301 para `/`. Fotos dos advogados e a capa do contato estão quebradas. |
| C04 | Conteúdo desatualizado (2023): endereço antigo (Alameda Rio Negro, 1030, cj 1501), fixo (11) 2321-2300, bios de 6 advogados, texto genérico (fusões e aquisições) fora do posicionamento atual (acidentes, INSS, indenizações). Hoje: Alameda Araguaia, 1142, "mais de 70 profissionais" (home), `CONTEXTO_MESTRE` cita fixo (11) 5286-6511. |
| C05 | Rewrite genérico do `vercel.json` manda qualquer slug para `/api/blog/post`. Arquivo físico em `dist/` tem precedência (é como os 491 posts funcionam). Página estática nova em `advocacia-sao-paulo/index.html` no `input` do Vite vence sem mexer no rewrite. Com e sem barra final respondem 200. |
| C06 | Sitemap é dinâmico (`api/blog/sitemap.js`): páginas fixas + benefícios + posts legados + posts do banco. Se os slugs saírem do `posts-data.json`, precisam entrar na lista fixa. `generate-posts.js` também gera `llms.txt` com as páginas principais. |
| C07 | `api/_lib/legacy-slugs.js` protege slugs legados de colisão com posts novos do banco. Manter os dois lá. |
| C08 | Padrão de página estratégica já existe em `beneficios/*/index.html`: head completo (title, description, canonical, OG), schema `@graph` (LegalService `#org` + Service + BreadcrumbList + FAQPage), GTM, fontes, `hero--page`, `section--paper`, FAQ, `cta-final`. Tokens em `style.css`. Clarity e Manychat injetados por plugin do Vite. |
| C09 | Home já tem seção `#escritorio` (fundação 2015, 70+ profissionais, OAB dos sócios, CNPJ, foto `equipe_escritorio_am.webp`, link YouTube). O item "Escritório" da nav aponta para a âncora, não para a página. As duas URLs têm **zero links internos** hoje: só chegam pelo Google. |
| C10 | Assets prontos: `img/felipe-almeida.webp`, `img/fellipe-matos.webp`, `img/socios_hero*.webp`, `img/equipe_escritorio_am.webp`, `img/equipe-atendimento-1/2.webp`, `img/equipe/` (41 retratos + `equipe_data.json`). |
| C11 | Drive (177 imagens): 23 JPG profissionais do escritório de 28/08/2026 (recepção com logo na parede de madeira, sofá, open office com plantas, gente trabalhando); ~85 HEIC de reuniões e treinamentos; 41 PNG verticais (capturas de gente na mesa); 28 HEIC da confraternização 2025 (foto oficial com ~70 pessoas). **Nenhuma foto dos sócios na pasta.** HEIC converte com `sips`; `cwebp` disponível. |
| C12 | GA4, 90 dias (ver tabela abaixo): `/advocacia-sao-paulo/` é a 5ª maior porta de entrada orgânica do site e as duas convertem em `whatsapp_click` bem acima da média. Tráfego é quase todo Google orgânico, com 3 sessões vindas do ChatGPT. |
| C13 | Evento `whatsapp_click` já instrumentado via GTM/dataLayer. Links usam `wa.me/5511930044411` com texto pré-preenchido "Vi o escritório pelo site...". Botão flutuante `.whats-fab` existe no CSS. |
| C14 | Rodapé e nav são HTML copiado em 12 arquivos (home, blog, template do post, hub e 7 benefícios, política). Link novo no rodapé = editar os 12. |

**GA4, últimos 90 dias (property 404445930)**

| Página | Sessões orgânicas | Key events | Conversão |
|---|---|---|---|
| `/` (home) | 683 | 189 | 28% |
| `/advocacia-sao-paulo/` | 72 | 16 | 22% |
| `/contato-advogado-sao-paulo/` | 34 | 12 | 35% |
| Post médio do blog (top 15) | 40 a 355 | 0 a 9 | 0 a 3% |

Leitura: quem chega nessas duas páginas já conhece o escritório (intenção de marca e local). Não é tráfego informacional. A página precisa confirmar quem somos e abrir o WhatsApp rápido, não "educar".

### Restrições e decisões (R)

| ID | Restrição |
|---|---|
| R01 | URLs mantidas exatamente. Trocar slug custaria o ranking sem ganho. |
| R02 | Identidade v5 do site (tokens de `style.css`, componentes de `beneficios/`). |
| R03 | Escrita sem cara de IA (`skills/copy/escrita-sem-cara-de-ia.md`) + tom institucional (`conteudo/institucional/tom-de-voz.md`). |
| R04 | Compliance OAB (Provimento 205/2021): sem promessa de resultado, sem valores, sem ranking, sem captação agressiva. |
| R05 | WhatsApp (11) 93004-4411 é o canal comercial; eventos GTM existentes continuam valendo. |
| R06 | Build local antes do push; push na main é produção. |
| R07 | Documentação no Notion A&M, não em artifact. |
| R08 | Nenhum número sem fonte (clientes, casos, taxa de êxito). |

### Pendências de terceiros (P)

| ID | Pendência | Suposição adotada |
|---|---|---|
| P01 | Bernardo aprova textos, fotos e push em produção | Commit local, prints, esperar OK |
| P02 | Telefone fixo atual e horário de atendimento (adm) | Contato só com WhatsApp e e-mail; fixo entra quando confirmar |
| P03 | Autorização de uso de imagem dos colaboradores nas fotos (RH) | A home já publica foto da equipe; usar fotos de ambiente e de grupo, evitar close individual |
| P04 | O que dizer dos sócios (bios curtas atualizadas) | Só os dois sócios, com OAB e 2 linhas cada, baseadas no texto atual; demais como "equipe" |
| P05 | Consultas reais do Search Console | Intenção majoritária de marca ("almeida e matos advogados", "endereço", "contato") + cauda "escritório de advocacia São Paulo" |
| P06 | Google Business Profile existe e tem o mesmo NAP? | Fora do escopo; registrado como ideia |

**Cobertura:** D01 → C01, C03, C04, C05, C08 a C11 · D02 → C01, C03, C04, C08, C13 · D03 → C05, C06, C07 · D04 → C02, C08, C09, C12, C14 · D05 → C10, C11, P03 · D06 → C13, C14 · D07 → processo (tema T7).

## 🔀 2. Temas e caminhos

### T1. Arquitetura: como sair do blog sem perder a URL

| Caminho | O que é | Esforço | Risco | Veredito |
|---|---|---|---|---|
| Mínimo | Corrigir title, description e trocar imagens dentro do JSON do post; continua artigo | 1 a 2 h | Continua com cara de blog; não atende D01 | Descartado |
| **Padrão** | Página estática Vite em `advocacia-sao-paulo/index.html` e `contato-advogado-sao-paulo/index.html` (mesmo molde de `beneficios/`); tirar os 2 slugs de `posts-data.json` e `blog/posts/` (duas cópias); manter em `legacy-slugs.js`; incluir na lista fixa do sitemap e no `llms.txt` | 3 a 5 h | Esquecer uma das cópias do JSON e o SSG sobrescrever a página | **Recomendado** |
| Ambicioso | Padrão + trocar slugs para `/escritorio/` e `/contato/` com 301 | 4 a 6 h | Perde parte do sinal, sem ganho | Descartado |

### T2. Intenção de busca e SEO on-page

| Caminho | O que é | Esforço | Risco |
|---|---|---|---|
| Mínimo | Title, description, canonical e OG corretos | 0,5 h | Não ganha nada além de parar de perder |
| **Padrão** | Title com marca + local + intenção; H1 humano; breadcrumb; schema `AboutPage`/`ContactPage` + `LegalService` reaproveitando o `#org` da home; FAQ curto com schema; links internos de ida e volta (rodapé de todas as páginas, seção da home, nav das páginas internas); alt descritivo | 1 a 2 h | Links no rodapé exigem editar 12 arquivos |
| Ambicioso | Padrão + `LocalBusiness` com geo, `openingHours`, `hasMap`; imagem estática do mapa com link para o Maps; texto "como chegar" + cobertura nacional | 2 a 3 h | `openingHours` depende de P02 |

### T3. Página do escritório: conteúdo

| Caminho | O que é | Esforço | Risco |
|---|---|---|---|
| Mínimo | Expandir o texto da seção `#escritorio` da home | 1 h | Página fina, duplica a home |
| **Padrão** | Hero (quem somos em uma frase + desde 2015 + 70+ profissionais + atendimento em todo o Brasil pelo WhatsApp); o que fazemos (7 áreas com link para cada benefício); os sócios (foto, OAB, 2 linhas); como trabalhamos (WhatsApp, conferência de documentos, processo eletrônico); o escritório em Alphaville (fotos); FAQ (5 perguntas de quem busca o escritório); CTA final | 3 a 4 h | Copy com cara de IA ou fora da OAB |
| Ambicioso | Padrão + equipe com nomes e retratos (`img/equipe/`), vídeo do YouTube, linha do tempo 2015 a 2026 | 5 a 7 h | Nomes de colaboradores exigem manutenção a cada saída |

### T4. Página de contato: conteúdo

| Caminho | O que é | Esforço | Risco |
|---|---|---|---|
| Mínimo | Cartão com endereço, WhatsApp e e-mail | 0,5 h | Não reduz a ansiedade de quem vai chamar |
| **Padrão** | Hero direto ("Fale com a equipe"); WhatsApp como caminho principal com CTA grande; e-mail; endereço com foto da recepção e link "como chegar"; "o que acontece depois que você manda mensagem" em 3 passos; aviso "atende todo o Brasil, não precisa vir ao escritório"; FAQ curto; sem formulário | 2 a 3 h | Dados de contato errados (P02) |
| Ambicioso | Padrão + formulário ligado ao Hub (como a LP B) + mensagem do WhatsApp pré-preenchida por origem | 4 a 6 h | Formulário cria fluxo novo de lead; regra da casa exige brainstorm próprio |

### T5. Imagens e performance

| Caminho | O que é | Esforço | Risco |
|---|---|---|---|
| Mínimo | Só assets já no repo (`socios_hero`, `equipe_escritorio_am`) | 0,5 h | Não usa o material novo do Drive |
| **Padrão** | Selecionar 6 a 10 fotos do Drive (recepção com logo, open office, equipe em reunião, foto de grupo); HEIC → JPG (`sips`) → WebP em 2 larguras (`cwebp`), ≤ 120 KB cada; `<picture>`/`srcset`, `width`/`height` fixos, `loading="lazy"` fora do hero, `fetchpriority="high"` no hero | 1 a 2 h | LCP pesado se a foto do hero passar de 150 KB |
| Ambicioso | Padrão + galeria/carrossel + sessão nova de fotos dos sócios | 3 h + terceiro | Depende de fotógrafo |

### T6. Conversão e mensuração

| Caminho | O que é | Esforço | Risco |
|---|---|---|---|
| Mínimo | CTA WhatsApp com o mesmo `whatsapp_click` das outras páginas | 0,2 h | Nenhum |
| **Padrão** | Mínimo + texto pré-preenchido identificando a página ("Vi a página do escritório...") + botão flutuante `.whats-fab` + baseline GA4 registrada hoje e comparação em D+30 | 0,5 h | Volume pequeno (≈100 sessões/90 d) limita leitura fina |
| Ambicioso | Teste A/B de hero | 2 h | Sem volume para significância; descartado |

### T7. Processo de produção (D07)

| Caminho | O que é | Esforço | Risco |
|---|---|---|---|
| Mínimo | Sessão escreve tudo sozinha | 3 a 4 h de sessão | Gasta o modelo caro em mecânica |
| **Padrão** | 3 specs em paralelo no sonnet (SEO, copy, UX/UI + webdesign) lendo as skills; síntese na sessão; implementação por agente sonnet com `beneficios/auxilio-acidente/` como molde; QA com Playwright (desktop e mobile), lint de escrita, checklist OAB; commit local; OK do Bernardo; push | 4 a 6 h no total | Specs divergirem; a síntese resolve |
| Ambicioso | `/orquestrar` com Workflow completo | idem + setup | Custo de coordenação maior que a demanda (2 páginas) |

### Ideias que não cabem agora

- Página "Equipe" com os 41 retratos que já existem em `img/equipe/`.
- Páginas locais ("advogado em Barueri", "advogado acidentário em Osasco") só depois de ver as consultas do Search Console.
- Auditoria do Google Business Profile (NAP, fotos novas, horário).
- Página "Trabalhe conosco" (o escritório contrata sem parar; hoje as vagas só vivem no LinkedIn).
- Tour em vídeo do escritório (o material do Drive já dá um reels).

## ⚠️ 3. Pré-mortem e variáveis

"Estamos em dezembro e deu errado. O que aconteceu?"

| # | Causa | Sinal precoce | Mitigação |
|---|---|---|---|
| 1 | Google rebaixou as páginas depois da troca de conteúdo e template | Queda de impressões no Search Console em 2 a 4 semanas | Mesma URL, 200, canonical igual; manter no texto os termos que já ranqueiam ("escritório de advocacia", "São Paulo", "Alphaville", "contato"); sitemap atualizado; pedir reindexação no GSC no dia do deploy |
| 2 | O SSG sobrescreveu a página nova com o artigo antigo | URL ainda mostra "Voltar para o blog" após o deploy | Remover o slug das duas cópias do JSON; teste pós-build (`grep "Voltar para o blog" dist/advocacia-sao-paulo/index.html` tem que falhar); checar a URL em produção |
| 3 | Fotos pesadas derrubaram LCP e Core Web Vitals | Lighthouse mobile < 80 | WebP ≤ 120 KB, dimensões fixas, `fetchpriority` no hero, lazy no resto; Lighthouse local antes do push |
| 4 | Colaborador que aparece na foto saiu ou pediu remoção | Pedido ao RH | Fotos de ambiente e grupo; confirmar autorização (P03); trocar foto é um commit |
| 5 | Telefone ou horário errado mandou cliente para o lugar errado | Reclamação no WhatsApp | Publicar só o que já está no schema; fixo só com confirmação (P02); NAP idêntico em home, schema e contato |
| 6 | Copy com cara de IA ou fora da OAB | Revisão do Bernardo devolve | Skill de escrita + checklist OAB antes do commit |
| 7 | Link novo no rodapé quebrou o layout em alguma das 12 páginas | Print mobile estranho | Playwright em 3 larguras nas 12 páginas; o rodapé já tem lista de links, é só um `<li>` a mais |
| 8 | Home e página do escritório disputando a mesma busca de marca | GSC mostra as duas alternando | Página mira "quem somos, endereço, contato"; home segue como principal. Sem canibalização real: intenções diferentes |
| 9 | Cache da CDN segurou a versão antiga | URL antiga por horas após o deploy | Deploy novo invalida o cache da Vercel; conferir com `curl -I` (`x-vercel-cache`) |

**Variáveis:** pessoas (manutenção zero: HTML estático; quem edita é tech/Bernardo) · dinheiro (custo recorrente zero) · prazo (1 a 2 dias úteis) · terceiros (P02, P03, P04) · LGPD (fotos + e-mail já público) · operação real (a página promete atendimento pelo WhatsApp; a recepção recebe visita só com agendamento? confirmar em P02) · dados (nada migra) · reversibilidade (alta: `git revert` + push, 2 minutos).

**Ordem que importa:** specs → (imagens em paralelo) → HTML → plumbing (JSON, sitemap, links) → build + QA → OK do Bernardo → push → reindexação → medir em D+30. Inverter plumbing e HTML não muda nada; pular o QA pós-build é o que mais custa (causa 2).

**Matriz por tema (caminho recomendado):**

| Tema | Impacto | Esforço | Risco |
|---|---|---|---|
| T1 Arquitetura padrão | alto | baixo | baixo |
| T2 SEO padrão | alto | baixo | baixo |
| T3 Escritório padrão | alto | médio | médio (copy) |
| T4 Contato padrão | alto | baixo | baixo |
| T5 Imagens padrão | médio | baixo | baixo |
| T6 Mensuração padrão | médio | baixo | baixo |
| T7 Processo padrão | n/a | médio | baixo |

## ✅ 4. Convergência

**Critérios de decisão:** (1) não perde a URL nem o 200; (2) responde à intenção real (quem somos, onde, como falar) em menos de 10 segundos no celular; (3) nada inventado; (4) reversível em um deploy; (5) manutenção zero; (6) medível com o que já existe.

**Recomendação por tema:** caminho **Padrão** em todos, com dois acréscimos baratos do Ambicioso: `LocalBusiness` básico sem `openingHours` até P02 (T2) e mensagem pré-preenchida por página (T6). Fica para depois: equipe nominal, formulário, vídeo, páginas locais.

**Decisões que só o Bernardo toma:**

| # | Decisão | Recomendação | Default se ninguém decidir |
|---|---|---|---|
| DB1 | Telefone fixo na página de contato? Qual? | Sim, se confirmar o número | Só WhatsApp e e-mail |
| DB2 | Fotos com colaboradores identificáveis? | Sim, ambiente e grupo (como a home já faz) | Sim, sem close individual |
| DB3 | Item "Escritório" da nav vira link para a página em todo o site? | Rodapé em todas + botão na seção da home + nav das páginas internas; home mantém a âncora | Esse |
| DB4 | Push em produção sem revisão prévia? | Não: commit local, prints, OK, push | Espera OK |
| DB5 | Bios individuais de outros advogados? | Só os dois sócios | Só os sócios |
| DB6 | Formulário na página de contato? | Não agora | Não |

**Descartado e por quê:** trocar slugs (perde sinal); só editar o JSON (continua blog); Workflow completo (custo > ganho); A/B (sem volume); mapa em iframe (peso e cookie de terceiro); equipe nominal (manutenção a cada saída).

## 🗺️ 5. Plano em etapas

| Etapa | Entregável | Faixa | Depende de | Quem |
|---|---|---|---|---|
| E1 Specs | 3 arquivos: `docs/spec-seo.md`, `docs/spec-copy.md`, `docs/spec-ux.md` + síntese | 1 a 2 h | brainstorm | 3 agentes sonnet + sessão |
| E2 Imagens | `img/escritorio/*.webp` (6 a 10 fotos, 2 larguras, ≤ 120 KB) + índice com origem | 0,5 a 1 h | C11 | sessão (script) |
| E3 Página Escritório | `advocacia-sao-paulo/index.html` no molde de `beneficios/`, com schema e imagens | 2 a 3 h | E1, E2 | agente sonnet |
| E4 Página Contato | `contato-advogado-sao-paulo/index.html` | 1 a 2 h | E1, E2 | agente sonnet |
| E5 Plumbing | Slugs fora de `posts-data.json` e `blog/posts/` (2 cópias); sitemap fixo; `llms.txt`; `vite.config.js`; links no rodapé das 12 páginas + botão na home | 1 h | E3, E4 | sessão |
| E6 QA | `npm run build` ok; `grep` no dist; Playwright em 390/768/1280 nas 2 páginas + rodapé das 12; Lighthouse mobile ≥ 90; lint de escrita; checklist OAB; HTML válido | 0,5 a 1 h | E5 | sessão |
| E7 Deploy | Commit local → prints para o Bernardo → OK → push → `curl -I` das 2 URLs + sitemap em produção → pedir reindexação no GSC → baseline GA4 anotada | 0,5 h | E6, P01 | sessão + Bernardo |
| E8 Medição | Comparativo D+30 (23/10/2026): sessões orgânicas e taxa de `whatsapp_click` vs. baseline (22% e 35%) | 0,5 h | E7 | sessão |

**Definição de pronto por etapa:**

- E1: cada spec tem seções numeradas, aponta arquivos e classes reais do repo, e a síntese resolve divergências por escrito.
- E2: pasta com WebP, tabela "arquivo → foto de origem no Drive → uso", nenhum arquivo > 120 KB no mobile.
- E3/E4: página abre em `vite preview`, head completo, schema válido no Rich Results Test, todos os CTAs com `wa.me` + evento, nenhuma imagem 404.
- E5: `dist/advocacia-sao-paulo/index.html` sem "Voltar para o blog"; `/sitemap.xml` local lista as 2 URLs; `grep -r "advocacia-sao-paulo" dist/*/index.html` acha o rodapé em todas.
- E6: prints em `docs/qa/`; Lighthouse anexado; checklist OAB assinado.
- E7: `curl -I` com 200 e `x-vercel-cache`; canonical igual; sitemap em produção com as URLs.

**Reversão:** `git revert <commit>` + push (2 minutos). Os JSONs antigos voltam junto.

**Riscos residuais:** rebaixamento temporário no Google por troca de conteúdo (causa 1), mitigado mas não eliminado; autorização de imagem (P03).

## 💡 6. Ideias que não cabem agora

Ver lista no fim da etapa 2. Prioridade sugerida: Google Business Profile → página Equipe → Trabalhe conosco → páginas locais.

## 🔍 7. Revisão final

Refutação adversarial (agente sonnet, `docs/brainstorm-refutacao.md`): 8 achados, 11 pontos confirmados no código. O que procedeu e o que mudou:

| # | Achado | Procede? | O que foi feito |
|---|---|---|---|
| 1 | Plumbing (E5) rodou antes das páginas existirem; se alguém buildasse nesse meio-tempo, as URLs virariam 404 | Sim, como regra de processo | Tudo entra num único commit (páginas + plumbing + links). Nunca commitar E5 separado de E3/E4. A frase "inverter plumbing e HTML não muda nada" vale só dentro do mesmo lote |
| 2 | DB1 (telefone) e DB5 (bios) não são decisões do Bernardo; são do adm e dos sócios | Sim | DB1 e DB5 viram validação do default pelo Bernardo; a pendência de dado fica em P02 e P04 |
| 3 | `public/blog/posts/` e `blog/posts/` não são cópias (491 vs 29 posts); o segundo é fallback antigo do sitemap | Sim | C05/E5 corrigidos: "remover o slug dos dois arquivos, sem tentar igualá-los" |
| 4 | Evento no código é `click_whatsapp`, não `whatsapp_click` | Parcialmente | No dataLayer é `click_whatsapp` (`main.js`); o GA4 exibe como `whatsapp_click` (renomeado no GTM). A baseline em `docs/qa/ga4-baseline-2026-09-23.json` registra os dois nomes |
| 5 | "Zero links internos" ignora o widget de posts relacionados (categoria "uncategorized", 57 posts) | Sim, detalhe | C09 passa a dizer "sem link de navegação; só aparecia em 'relacionados' de outros posts" |
| 6 | `vercel.json` deveria excluir os dois prefixos do rewrite, como já faz com `beneficios` e `politica-de-privacidade` | Sim | Feito: prefixos adicionados ao lookahead negativo |
| 7 | Soma das faixas (6,5 a 10,5 h) não bate com "4 a 6 h" do T7 | Sim | T7 é tempo de parede com E1 ∥ E2 e E3 ∥ E4; esforço somado fica 6,5 a 10,5 h |
| 8 | Tabela GA4 sem export salvo | Sim | Export salvo em `docs/qa/ga4-baseline-2026-09-23.json` |

**Cobertura:** D01 → E3 · D02 → E4 · D03 → E5, E7 · D04 → E1, E3, E4, E5 · D05 → E2 · D06 → E6 · D07 → E1 (processo). Nenhuma demanda ficou fora.

**Execução no mesmo dia (23/09):** E1 a E6 concluídas. Specs em `docs/spec-seo.md`, `docs/spec-copy.md`, `docs/spec-ux.md`; fotos em `img/escritorio/`; páginas em `advocacia-sao-paulo/index.html` e `contato-advogado-sao-paulo/index.html`; prints em `docs/qa/new_*.png`; Lighthouse em `docs/qa/lh_*.json`. E7 (push) aguarda o OK do Bernardo. E8 marcada para 23/10/2026.

**Síntese das specs (o que a sessão decidiu quando elas divergiram):** titles mantidos iguais aos atuais (já ranqueiam e são a intenção de marca); H1 humano em 2 linhas; fatos da faixa de provas copiados da home (11 anos, 10 mil+ pessoas atendidas, 70+ profissionais, Brasil todo); horário e aviso anti-golpe entraram porque já estão publicados no rodapé; telefone fixo ficou de fora (P02); bios só dos dois sócios (P04); galeria com 4 fotos (2 largas + 2 em 4:3) em vez de 3; "Como trabalhamos" em 4 passos com a lista numerada do site; nav "Escritório" das 11 páginas internas passou a apontar para a página (na home continua a âncora).

> **Uso deste documento** Bernardo lê as decisões DB1 a DB6 e o plano E1 a E8. Quem implementa segue a definição de pronto de cada etapa. Depois do deploy, o comparativo D+30 entra na seção 7.
