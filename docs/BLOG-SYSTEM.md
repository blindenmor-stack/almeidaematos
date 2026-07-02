# Sistema de Blog Automatizado — Almeida & Matos

> Blog com geração de artigos por IA (Gemini), fila de pautas, painel admin com senha
> e publicação agendada via Vercel Cron. Convive com os 491 posts legados (SSG) sem
> tocar neles: **arquivos estáticos têm precedência sobre rewrites na Vercel**, então
> os posts novos (servidos por function) só respondem quando não existe HTML físico.

---

## 1. Arquitetura

```
                         ┌──────────────────────────────────────────────┐
                         │              SUPABASE (Postgres)             │
                         │  schema aquisicao:                           │
                         │   blog_posts · blog_settings · blog_topics   │
                         │   blog_generation_log                        │
                         └───────▲──────────────▲───────────────▲──────┘
                                 │ PostgREST    │               │
     Vercel Cron (diário 7h BRT) │              │               │
   ┌────────────────────────┐    │   ┌──────────┴─────────┐   ┌─┴──────────────────┐
   │ /api/cron/generate-post├────┘   │  /api/admin/*      │   │  /api/blog/*       │
   │  Bearer CRON_SECRET    │        │  x-admin-password  │   │  público (cache)   │
   │  settings→pauta→Gemini │        │  posts/settings/   │   │  post (HTML SSR)   │
   │  →valida→insere→loga   │        │  topics/generate   │   │  list (JSON)       │
   └───────────┬────────────┘        └─────────▲──────────┘   │  sitemap (XML)     │
               │                               │              └─────────▲──────────┘
        ┌──────▼──────┐                 ┌──────┴───────┐                │
        │  Gemini API │                 │  /admin/ SPA │         visitantes /
        │ (JSON mode) │                 │ (senha, noindex)       Googlebot
        └─────────────┘                 └──────────────┘
```

**Fluxo de um post automático:**
1. Cron da Vercel chama `/api/cron/generate-post` todo dia às 10:00 UTC (7h BRT).
2. A function checa: `enabled`? hoje é `publish_day` (fuso America/Sao_Paulo)? já gerou hoje (consulta `blog_generation_log`)?
3. Pega a pauta `pending` de maior prioridade em `blog_topics` (fila vazia → a IA sugere uma pauta nova baseada na linha editorial e registra na fila).
4. Gera o artigo via Gemini (REST `generateContent`, `responseMimeType: application/json` + `responseSchema` — saída estruturada com title, slug, excerpt, metas, content_html, faq, read_time).
5. Valida: slug único (colidiu → sufixa `-2`, `-3`…), mínimo 600 palavras, sanitiza HTML (remove script/iframe/handlers), normaliza categoria pras 4 existentes.
6. Insere em `blog_posts` como `published` (ou `draft` se `auto_publish=false`) e marca a pauta como `used`.
7. Loga tudo (sucesso, skip ou erro) em `blog_generation_log`.

**Servindo o post:** `https://almeidaematos.com.br/{slug}/` → rewrite → `/api/blog/post?slug={slug}` → HTML completo renderizado server-side (metas, OG, JSON-LD Article + FAQPage + BreadcrumbList, FAQ visível, CTA WhatsApp), com `Cache-Control: s-maxage=3600, stale-while-revalidate=86400` na CDN.

---

## 2. Arquivos do sistema

| Arquivo | Papel |
|---|---|
| `sql/001_blog_schema.sql` | Migração única e idempotente (tabelas, índices, trigger, RLS, GRANTs, seed com settings + 18 pautas) |
| `api/_lib/supabase.js` | `sbFetch()` — cliente PostgREST com `Accept-Profile`/`Content-Profile: aquisicao` |
| `api/_lib/auth.js` | `requireAdmin()` / `checkPassword()` — senha via header `x-admin-password`, comparação timing-safe |
| `api/_lib/util.js` | `esc()`, `slugify()`, `sanitizeHtml()`, datas em America/Sao_Paulo, leitura de body |
| `api/_lib/prompt.js` | Prompt editorial (compliance OAB + AEO/SEO + linkagem interna) e responseSchemas do Gemini |
| `api/_lib/generate.js` | Motor de geração compartilhado (cron + manual) |
| `api/_lib/template.js` | Template HTML standalone do post público (design system v2) e página 404 |
| `api/blog/post.js` | GET público — HTML do post por slug |
| `api/blog/list.js` | GET público — JSON no shape do `posts-data.json` |
| `api/blog/sitemap.js` | GET — sitemap.xml (páginas fixas + 7 produtos + 491 legados + posts do banco) |
| `api/admin/login.js` | POST {password} → 200/401 |
| `api/admin/posts.js` | CRUD de posts (GET lista/por id, POST manual, PATCH, DELETE=arquivar) |
| `api/admin/settings.js` | GET/PATCH das configurações |
| `api/admin/topics.js` | CRUD da fila de pautas (DELETE=descartar) |
| `api/admin/generate.js` | POST — gera 1 post agora (pauta da fila, livre ou automática) |
| `api/cron/generate-post.js` | Cron diário protegido por `CRON_SECRET` |
| `admin/index.html` + `admin/admin.js` + `admin/admin.css` | Painel admin (SPA vanilla, noindex) |
| `.env.example` | Gabarito das env vars |

---

## 3. Como ativar (passo a passo)

### 3.1 Banco (Supabase)
1. Abra o **SQL Editor** do projeto `argvppsbnoeyozjepagb` e rode o conteúdo de `sql/001_blog_schema.sql` inteiro (é idempotente — pode rodar de novo sem quebrar).
2. **Expor o schema:** Dashboard → **Settings → API → Exposed schemas** → adicionar `aquisicao` à lista. Sem isso o PostgREST responde 406 a tudo.

### 3.2 Env vars (Vercel → Settings → Environment Variables)
| Nome | Valor |
|---|---|
| `SUPABASE_URL` | `https://argvppsbnoeyozjepagb.supabase.co` |
| `SUPABASE_SECRET_KEY` | service_role key (Supabase → Settings → API) |
| `GEMINI_API_KEY` | chave do Google AI Studio |
| `ADMIN_PASSWORD` | senha do painel `/admin/` |
| `CRON_SECRET` | string aleatória longa (`openssl rand -hex 32`) |

> A Vercel injeta `Authorization: Bearer $CRON_SECRET` automaticamente nas invocações de cron quando a env `CRON_SECRET` existe no projeto.

### 3.3 Gemini API key
Google AI Studio (aistudio.google.com) → Get API key. O modelo padrão é `gemini-pro-latest` (Gemini Pro mais recente — melhor escrita; `gemini-flash-latest` é a opção rápida/barata) (troca no painel admin, aba Linha editorial).

---

## 4. Mudanças que o ORQUESTRADOR precisa fazer (fora deste pacote)

### 4.1 `vercel.json` — cron + rewrites + functions

```jsonc
{
  // 1. CRON — roda todo dia 10:00 UTC = 7h BRT (a frequência semanal
  //    é controlada pelas settings no banco, não pelo schedule)
  "crons": [
    { "path": "/api/cron/generate-post", "schedule": "0 10 * * *" }
  ],

  // 2. FUNCTIONS — o sitemap lê public/blog/posts/posts-data.json do
  //    filesystem; garante que o arquivo entra no bundle da function
  "functions": {
    "api/blog/sitemap.js": { "includeFiles": "public/blog/posts/posts-data.json" }
  },

  "rewrites": [
    // 3. SITEMAP dinâmico substitui o estático — o rewrite SÓ funciona se o
    //    arquivo físico public/sitemap.xml for REMOVIDO do projeto (na Vercel,
    //    arquivo físico tem precedência sobre rewrite)
    { "source": "/sitemap.xml", "destination": "/api/blog/sitemap" },

    // 4. SLUG dinâmico — apontar o rewrite atual para a function em vez do
    //    blog-post.html. Como arquivos físicos têm precedência, os 491 posts
    //    SSG (dist/{slug}/index.html) continuam sendo servidos estáticos;
    //    a function só atende slugs que não existem no filesystem.
    //    Acrescentar `admin|beneficios` à negativa (páginas reais do site).
    {
      "source": "/:slug((?!blog|assets|img|api|_next|favicon|robots|sitemap|admin|beneficios).*)",
      "destination": "/api/blog/post?slug=$slug"
    }
  ]
}
```

Observações:
- Manter os `redirects` e `headers` existentes do vercel.json — acima estão só as adições/mudanças.
- Na sintaxe da Vercel, o parâmetro nomeado `:slug` fica disponível como `$slug` no destination.
- O 404 da function já sai com `noindex` e canonical na home (sem soft-404).
- `/admin/` não precisa de rewrite se a pasta for copiada pro build (abaixo) — arquivo físico `dist/admin/index.html` é servido direto. A exclusão no regex do slug é cinto de segurança.

### 4.2 `package.json` — copiar o admin pro build

O painel é HTML/CSS/JS puro com referências relativas — não precisa de bundling.
Basta copiar a pasta no build:

```json
"build": "vite build && node scripts/generate-posts.js && cp -R admin dist/admin"
```

(Alternativa: mover `admin/` para `public/admin/` — o Vite copia `public/` inteiro.
 Mantivemos na raiz pra não misturar com assets do site.)

### 4.3 Nenhuma dependência nova
As functions usam só `fetch` global e `node:crypto`/`node:fs` (Node 18+). Nada pra instalar.

---

## 5. Endpoints (referência rápida)

### Públicos
| Endpoint | Descrição |
|---|---|
| `GET /api/blog/post?slug={slug}` | HTML completo do post published. Cache CDN 1h (+24h stale). 404 noindex se não achar. |
| `GET /api/blog/list?limit=&offset=&category=` | JSON de posts published no shape do `posts-data.json` (`{title, slug, date, excerpt, category, categorySlug, author, readTime}`). Cache 10min. |
| `GET /api/blog/sitemap` | sitemap.xml completo. Cache 1h. |

### Admin (header `x-admin-password` obrigatório)
| Endpoint | Descrição |
|---|---|
| `POST /api/admin/login` | `{password}` → `{ok:true}` ou 401 |
| `GET /api/admin/posts?limit=&offset=&status=&q=` | Lista (qualquer status). `?id=` retorna o registro completo. |
| `POST /api/admin/posts` | Cria post manual (`origin='manual'`, default draft) |
| `PATCH /api/admin/posts?id=` | Edita (title, slug, content_html, excerpt, status, faq, metas…) |
| `DELETE /api/admin/posts?id=` | **Arquiva** (status=archived — nunca deleta de verdade) |
| `GET/PATCH /api/admin/settings` | Configurações (enabled, dias, auto_publish, linha editorial, modelo) |
| `GET/POST/PATCH/DELETE /api/admin/topics` | Fila de pautas (DELETE = descartar, soft) |
| `POST /api/admin/generate` | Gera 1 post agora. Body opcional: `{topic_id}` ou `{topic: "texto livre"}` |

### Cron
| Endpoint | Descrição |
|---|---|
| `GET /api/cron/generate-post` | `Authorization: Bearer $CRON_SECRET`. Skips não são erro (respondem 200 + log `skipped`). |

---

## 6. Painel admin (`/admin/`)

- **Login:** senha única (`ADMIN_PASSWORD`), guardada em sessionStorage e revalidada a cada abertura. 401 em qualquer chamada → volta pro login.
- **Dashboard:** cards (publicados, rascunhos, pautas na fila, próxima publicação) + tabela de posts com busca, filtro de status e ações por linha: publicar/despublicar, editar (modal com título, slug, excerpt, metas, HTML e editor de FAQ), arquivar.
- **Gerar post agora:** escolhe pauta da fila, digita pauta livre ou deixa automático (maior prioridade). Mostra loading e abre o post publicado ao final.
- **Pautas:** adicionar (tema, keyword, produto, prioridade), editar prioridade inline, descartar/restaurar.
- **Linha editorial:** liga/desliga o sistema, publicar direto vs rascunho, dias da semana (chips), posts/semana, modelo de IA, linha editorial, tom e instruções extras.
- `noindex, nofollow` na meta — não indexa.

---

## 7. Regras editoriais embutidas no prompt (`api/_lib/prompt.js`)

- **Persona:** advogado-educador brasileiro; simples, direto, empático; explica todo termo técnico.
- **Compliance OAB:** sem promessa de resultado, sem urgência artificial, sem valores de honorários/casos; tom educativo.
- **AEO/SEO:** primeiro parágrafo responde a pergunta em até 3 frases (answer-first); H2s como perguntas; listas/tabelas; seção "Perguntas frequentes" no fim (espelha o `faq` jsonb → schema FAQPage); fundamenta com legislação real (Lei 8.213/91, LC 142/2013, Lei 8.742/93…); **proibido inventar** estatísticas, decisões ou prazos.
- **Linkagem interna:** 2-3 links contextuais pra `/beneficios/{produto}/`; menção discreta ao WhatsApp no fim (o botão real vem do template).
- **Formato:** HTML semântico (h2, h3, p, ul, ol, table, strong), sem h1, sem style inline, sem markdown; 900–1400 palavras.

---

## 8. Decisões técnicas & gotchas

1. **CSS do post é embutido no template** (`api/_lib/template.js`), não importa o `style.css` do site — o Vite gera assets com hash imprevisível (`/assets/style-XXXX.css`), então a function não teria como referenciá-lo com segurança. O template replica os tokens do `docs/DESIGN-SYSTEM-V2.md`.
2. **Precedência filesystem > rewrite** na Vercel é o que faz os 491 posts SSG continuarem estáticos com o rewrite apontando pra function. Não precisa de lógica de "existe arquivo?".
3. **Soft delete em tudo:** posts arquivam (`archived`), pautas descartam (`discarded`). Nada some do banco.
4. **1 post/dia no máximo:** o cron roda diário e o guard de "já gerou hoje" consulta o `blog_generation_log` a partir da meia-noite de São Paulo (`YYYY-MM-DDT00:00:00-03:00`).
5. **Timezone:** toda lógica de publicação usa `Intl.DateTimeFormat` com `America/Sao_Paulo` (`api/_lib/util.js`) — nunca o relógio UTC da function.
6. **`maxDuration: 300`** exportado em `api/admin/generate.js` e `api/cron/generate-post.js` (geração pode levar minutos). Se o plano da Vercel não aceitar via `export const config`, mover pro `vercel.json`: `"functions": {"api/cron/generate-post.js": {"maxDuration": 300}, "api/admin/generate.js": {"maxDuration": 300}}`.
7. **RLS + service_role:** as tabelas têm RLS ligado com policy só pra `service_role`. A anon key NÃO acessa nada do blog — o front só fala com as functions.
8. **Sanitização:** `sanitizeHtml()` remove script/style/iframe/handlers `on*`/`javascript:` de todo HTML que entra (IA ou admin); `esc()` escapa tudo que interpola no template. JSON-LD escapa `<` como `\u003c` (anti-XSS dentro da script tag).
9. **Slug colidiu → sufixa** `-2`, `-3`… consultando os existentes numa query só (`slug=like.base*`).
10. **Fila de pautas vazia não para o sistema:** a IA gera uma pauta nova (registrada em `blog_topics` com nota "gerada por IA") e segue o fluxo.
11. **Sitemap resiliente:** se o Supabase estiver fora, o sitemap ainda sai com home + produtos + 491 legados (o erro é só logado).
12. **`/blog/` (listagem):** o front atual lê `posts-data.json` (estático). Para os posts novos aparecerem na listagem, o agente do front deve mesclar `GET /api/blog/list` (mesmo shape) com o JSON estático — mudança de ~5 linhas no `blog.js`, fora do escopo deste pacote.

---

## 9. Monitoramento

- **Log de geração:** tabela `aquisicao.blog_generation_log` (status success/error/skipped, detail, modelo, duração). Consultar no Supabase ou via SQL Editor.
- **Logs de runtime:** Vercel → Deployments → Functions (erros de function aparecem lá com prefixo do endpoint).
- **Custo Gemini:** `gemini-2.5-flash` gera um artigo de ~1200 palavras por fração de centavo de dólar; com 3 posts/semana o custo é irrisório.
