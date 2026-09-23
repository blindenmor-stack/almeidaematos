# Spec UX/UI — Páginas Escritório e Contato

Data: 2026-09-23 · Base: `docs/brainstorm-paginas-escritorio-contato.md`. Ler `style.css` inteiro e `beneficios/auxilio-acidente/index.html` (molde) antes de implementar. Esta spec só usa classes que já existem — a seção 4 lista as exceções.

## 1. Princípios

Quem chega nessas URLs já busca a marca pelo nome (GA4: 22–35% conversão em `whatsapp_click`, acima da média do blog). É tráfego para **confirmar**, não para educar.

1. Responder em <10s no celular: quem somos, onde estamos, como falar — na primeira dobra, sem depender de scroll.
2. CTA WhatsApp sempre visível: `.whats-fab` fixo + CTA no hero + CTA final.
3. Sem educar (isso é papel de `/beneficios/`): aqui é prova de que existe, prova de seriedade, caminho de contato.
4. Reuso total de componente — a seção 4 é a única exceção documentada.
5. Compliance OAB: sem promessa de resultado, sem "melhor escritório", sem estatística de êxito.
6. Mesmo hero/footer/nav das outras páginas internas — só o miolo muda.

## 2. Página do Escritório (`advocacia-sao-paulo/index.html`)

Ordem: hero → provas → 7 cards (o que fazemos) → sócios → como trabalhamos → escritório em fotos → FAQ → CTA final → footer.

### 2.1 Hero
**Classes:** `.hero.hero--page`, `.hero__mark.hero__mark--page`, `.container`, `.hero__grid`, `.breadcrumb`, `.eyebrow.hero__eyebrow`, `.display.hero__title` + `.hero__line > [data-hero-line]`, `.answer-box`, `.hero__ctas`, `.btn--whatsapp`, `.btn--ghost-dark`.

- **390:** 1 coluna, título `clamp(2rem,4.2vw,3.2rem)` (regra `.hero--page` já cobre); breadcrumb quebra livre; CTAs empilham full-width (`≤560px` já força isso).
- **768:** mesma coluna única (não há grid de 2 col em `.hero--page`); CTAs lado a lado se couberem.
- **1280:** título até `3.6rem`, `max-width:20ch`; `answer-box` até `44rem`.

**Foto:** nenhuma — hero de página interna não carrega imagem (só `hero__mark--page` vazado de fundo), igual a todo `beneficios/*`. Mantém LCP leve.

**Hierarquia:** eyebrow → H1 em 3 linhas curtas (`hero__line`) → `answer-box` com resposta direta em negrito → CTA.

**Animação:** `data-hero-fade` (breadcrumb, eyebrow, answer-box, CTAs) + `data-hero-line` (spans do H1).

**Não fazer:** grid de 2 colunas com foto de sócios no hero (isso é `.hero--home`, não página interna); `cut-t` aqui (reservado à chamada final); números sem fonte confirmada.
```html
<section class="hero hero--page">
  <svg class="hero__mark hero__mark--page" viewBox="0 0 400 351" aria-hidden="true" style="--mk-gold:transparent;--mk-navy:transparent;--mk-gray:transparent;--mk-stroke:#354271;--mk-sw:0.9"><use href="#am-mark"/></svg>
  <div class="container"><div class="hero__grid"><div>
    <nav class="breadcrumb" aria-label="Você está em" data-hero-fade><a href="/">Início</a><i></i><span>Escritório</span></nav>
    <p class="eyebrow hero__eyebrow" data-hero-fade>{{copy: eyebrow}}</p>
    <h1 class="display hero__title">
      <span class="hero__line"><span data-hero-line>{{copy: linha 1}}</span></span>
      <span class="hero__line"><span data-hero-line>{{copy: linha 2}}</span></span>
    </h1>
    <div class="answer-box" data-hero-fade><b>{{copy: resposta direta}}</b> {{copy: complemento}}</div>
    <div class="hero__ctas" style="margin-top:2rem" data-hero-fade>
      <a class="btn btn--whatsapp" href="https://wa.me/5511930044411?text={{copy}}" target="_blank" rel="noopener">{{copy: CTA WhatsApp}}</a>
      <a class="btn btn--ghost-dark" href="/contato-advogado-sao-paulo/">{{copy: Ver formas de contato}}</a>
    </div>
  </div></div></div>
</section>
```
### 2.2 Provas (faixa de fatos)
**Classes:** `.section.section--white` (`padding-block:0` inline, como na home), `.facts`, `.fact`.
- **390:** `.facts` → `repeat(2,1fr)` (regra `≤860px` já existe).
- **768:** ainda 2 colunas (breakpoint 4→2 é em 860px).
- **1280:** `repeat(4,1fr)`.

**Foto:** nenhuma. **Hierarquia:** `.fact strong` (número) + `.fact span` (legenda). **Animação:** nenhuma (a home também não anima essa faixa).
**Não fazer:** `data-counter` (o CSS já documenta "sem contador"); inventar 5º número sem fonte.
```html
<section class="section section--white" style="padding-block:0" aria-label="Números do escritório">
  <div class="container"><div class="facts">
    <div class="fact"><strong>{{copy}}</strong><span>{{copy}}</span></div>
    <div class="fact"><strong>{{copy}}</strong><span>{{copy}}</span></div>
    <div class="fact"><strong>{{copy}}</strong><span>{{copy}}</span></div>
    <div class="fact"><strong>{{copy}}</strong><span>{{copy}}</span></div>
  </div></div>
</section>
```
### 2.3 O que fazemos (7 cards)
**Classes:** cópia exata do bloco "Qual é a sua situação?" da home (`index.html` L361–410): `.section.section--paper-2`, `.section-head`, `.eyebrow`, `.display`, `.lead`, `.grid-3`, `.card`, `.card__icon`, `.card__link` + SVG seta, `.card--wide` no 7º item.
- **390/768:** `.grid-3` → `1fr` (breakpoint `≤860px`).
- **1280:** 3 colunas; `card--wide` ocupa a linha inteira.

**Foto:** nenhuma. **Hierarquia:** eyebrow → H2 → lead → grid de cards (h3+p+link). **Animação:** `data-card` em cada `<article>` (stagger por container-pai).
**Não fazer:** duplicar o texto da home 1:1 (SEO de conteúdo duplicado) — reescrever a descrição mantendo a estrutura; não adicionar 8º card.

Esqueleto: idêntico ao bloco de `index.html` L369–408, trocando `data-reveal`/`data-reveal-title` no cabeçalho e mantendo `data-card` nos 7 `<article>`.

### 2.4 Os sócios
**Classes:** `.section.section--white`, `.section-head` + classe nova `.founders`/`.founder` (seção 4 — `.split` não serve porque é 1 foto+1 texto, aqui são 2 pessoas lado a lado).
- **390:** 2 cartões empilham em 1 coluna.
- **768:** 2 colunas (decisão de layout: a partir de 640px, ver CSS §4).
- **1280:** 2 colunas fixas, foto quadrada 1:1.

**Fotos:** `img/felipe-almeida.webp`, `img/fellipe-matos.webp` (já existem no repo). **Hierarquia:** eyebrow → H2 → 2 cartões (foto 1:1 → nome → OAB → 2 linhas de bio). **Animação:** `data-reveal` no cabeçalho, `data-card` nos 2 cartões.
**Não fazer:** bios de outros advogados (DB5: só os 2 sócios); close excessivamente recortado.
```html
<section class="section section--paper-2">
  <div class="container">
    <div class="section-head"><p class="eyebrow" data-reveal>{{copy}}</p><h2 class="display" data-reveal-title>{{copy: Quem está por trás da Almeida & Matos}}</h2></div>
    <div class="founders">
      <article class="founder" data-card>
        <figure class="founder__photo"><img src="/img/felipe-almeida.webp" alt="{{copy}}" width="800" height="800" loading="lazy"></figure>
        <h3>Felipe Almeida</h3><p class="founder__oab">OAB/SP 338.615</p><p>{{copy: bio}}</p>
      </article>
      <article class="founder" data-card>
        <figure class="founder__photo"><img src="/img/fellipe-matos.webp" alt="{{copy}}" width="800" height="800" loading="lazy"></figure>
        <h3>Fellipe Matos</h3><p class="founder__oab">OAB/SP 345.432</p><p>{{copy: bio}}</p>
      </article>
    </div>
  </div>
</section>
```
### 2.5 Como trabalhamos
**Classes:** `.section.section--white`, `.section-head`, `.commit` (3 blocos com filete dourado, já usado na home).
- **390/768/1280:** `.commit` é `repeat(3,1fr)` em desktop, `1fr` em `≤860px` (regra já existe).

**Foto:** nenhuma. **Hierarquia:** H2 → 3 blocos (filete + h3 + p). **Animação:** `data-reveal-title` no H2, `data-reveal` em cada bloco.
**Não fazer:** repetir os 3 textos de "O que muda..." da home — usar ângulo diferente (WhatsApp como canal único, conferência de documentos, processo eletrônico).
```html
<section class="section section--white">
  <div class="container">
    <div class="section-head"><h2 class="display" data-reveal-title>{{copy: Como trabalhamos}}</h2></div>
    <div class="commit">
      <div data-reveal><h3>{{copy}}</h3><p>{{copy}}</p></div>
      <div data-reveal><h3>{{copy}}</h3><p>{{copy}}</p></div>
      <div data-reveal><h3>{{copy}}</h3><p>{{copy}}</p></div>
    </div>
  </div>
</section>
```
### 2.6 O escritório em fotos
**Classes:** `.section.section--paper-2`, `.section-head` + classe nova `.gallery`/`.gallery__item` (seção 4 — não existe grade hoje; `.office` é 1 foto+texto, `.band`/`.split` são foto única).
- **390:** grade 1 coluna, fotos 4:3 empilhadas.
- **768:** grade 2 colunas.
- **1280:** mosaico — 1 item largo (`gallery__item--wide`, 16:9) + 2 itens 4:3.

**Fotos e crop:** `recepcao-sofa-wide` (item wide, mostra logo+ambiente), `open-office-plantas` (4:3), `equipe-reuniao-1` (4:3, rostos pequenos — OK pra LGPD). `object-fit:cover`, `border-radius:8px`. **Hierarquia:** eyebrow → H2 curto → grade sem legenda extensa. **Animação:** `data-card` em cada `<figure>`.
**Não fazer:** carrossel (proibido); lightbox/modal novo; foto com rosto em close individual identificável (DB2: só ambiente/grupo).
```html
<section class="section section--paper-2">
  <div class="container">
    <div class="section-head"><p class="eyebrow" data-reveal>{{copy}}</p><h2 class="display" data-reveal-title>{{copy: O escritório em Alphaville}}</h2></div>
    <div class="gallery">
      <figure class="gallery__item gallery__item--wide" data-card><img src="/img/escritorio/recepcao-sofa-wide-1600.webp" alt="{{copy}}" width="1600" height="900" loading="lazy"></figure>
      <figure class="gallery__item" data-card><img src="/img/escritorio/open-office-plantas-1600.webp" alt="{{copy}}" width="1600" height="1200" loading="lazy"></figure>
      <figure class="gallery__item" data-card><img src="/img/escritorio/equipe-reuniao-1-1600.webp" alt="{{copy}}" width="1600" height="1200" loading="lazy"></figure>
    </div>
  </div>
</section>
```
### 2.7 FAQ
Cópia exata do padrão `auxilio-acidente/index.html` L285–319: `.section.section--white` (alterna com `--paper-2` da seção anterior pra manter zebrado), `.section-head.section-head--center`, `.eyebrow--center`, `.faq`, `.faq__item` (`<details>`), `.faq__icon`, `.faq__answer`/`-inner`. `.faq{max-width:760px}` já é responsivo em qualquer largura.

5 perguntas sugeridas (copy fica no spec de copy): atendem todo o Brasil? precisa ir ao escritório? como é o primeiro contato? quanto custa? há quanto tempo o escritório atua?

**Animação:** `data-reveal` (eyebrow, cada `.faq__item`), `data-reveal-title` (H2).
**Não fazer:** repetir as perguntas do FAQ de `auxilio-acidente` (são sobre o benefício, não sobre o escritório).

### 2.8 CTA final
Cópia exata de `auxilio-acidente/index.html` L322–333: `.section.cta-final.cut-t`, `.cta-final__mark`, `.display`, `.btn--whatsapp`, `.btn--ghost` (linka para `/contato-advogado-sao-paulo/` em vez de `/beneficios/`).
**Não fazer:** usar `cut-t` em qualquer outra seção da página (é a única vez que o corte diagonal aparece).
```html
<section class="section cta-final cut-t">
  <svg class="cta-final__mark" viewBox="0 0 400 351" aria-hidden="true" style="--mk-gold:transparent;--mk-navy:transparent;--mk-gray:transparent;--mk-stroke:#D2AE6D;--mk-sw:0.8"><use href="#am-mark"/></svg>
  <div class="container">
    <h2 class="display" data-reveal-title>{{copy}}</h2>
    <div style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin-top:2.4rem" data-reveal>
      <a class="btn btn--whatsapp" href="https://wa.me/5511930044411?text={{copy}}" target="_blank" rel="noopener">{{copy}}</a>
      <a class="btn btn--ghost" href="/contato-advogado-sao-paulo/">{{copy: Ver formas de contato}}</a>
    </div>
  </div>
</section>
```

## 3. Página de Contato (`contato-advogado-sao-paulo/index.html`)

Ordem: hero curto → cartões de canal → endereço com foto → depois da mensagem (3 passos) → aviso Brasil + anti-golpe → FAQ → CTA final → footer.

### 3.1 Hero — mais curto que o padrão
**Avaliação: sim.** Quem busca "contato advogado" já decidiu — corta eyebrow longa + `answer-box`: breadcrumb → H1 (1–2 linhas) → `.hero__sub` (1 frase) → 1 CTA único (sem ghost ao lado). Reduz ~30% da altura do hero.

**Classes:** `.hero.hero--page`, `.hero__mark--page`, `.breadcrumb`, `.display.hero__title`, `.hero__sub` (em vez de `.answer-box`), `.hero__ctas`, `.btn--whatsapp` único.
- **390:** título 1–2 linhas, CTA full-width.
- **768/1280:** título até `3.2rem`; compensar altura menor com respiro vertical levemente maior.

**Foto:** nenhuma. **Animação:** `data-hero-fade` (breadcrumb/eyebrow/sub/CTA), `data-hero-line` (H1).
**Não fazer:** `.answer-box` aqui (é para responder pergunta jurídica); 2 CTAs concorrendo no hero.
```html
<section class="hero hero--page">
  <svg class="hero__mark hero__mark--page" viewBox="0 0 400 351" aria-hidden="true" style="--mk-gold:transparent;--mk-navy:transparent;--mk-gray:transparent;--mk-stroke:#354271;--mk-sw:0.9"><use href="#am-mark"/></svg>
  <div class="container"><div class="hero__grid"><div>
    <nav class="breadcrumb" aria-label="Você está em" data-hero-fade><a href="/">Início</a><i></i><span>Contato</span></nav>
    <p class="eyebrow hero__eyebrow" data-hero-fade>{{copy}}</p>
    <h1 class="display hero__title"><span class="hero__line"><span data-hero-line>{{copy: Fale com a equipe}}</span></span></h1>
    <p class="hero__sub" data-hero-fade>{{copy: 1 frase de apoio}}</p>
    <div class="hero__ctas" style="margin-top:1.6rem" data-hero-fade>
      <a class="btn btn--whatsapp" href="https://wa.me/5511930044411?text={{copy}}" target="_blank" rel="noopener">{{copy: CTA grande}}</a>
    </div>
  </div></div></div>
</section>
```
### 3.2 Cartões de canal (WhatsApp, e-mail)
**Classes:** `.section.section--paper`, `.section-head`, `.grid-2` (já existe) + classe nova `.channel-card` (variante de `.card`, seção 4).
- **390:** `.grid-2` → `1fr` (regra `≤560px`).
- **768/1280:** 2 colunas lado a lado.

**Hierarquia:** ícone circular → título do canal → texto curto → CTA. **Animação:** `data-card` em cada cartão.
**Não fazer:** telefone fixo (DB1: default só WhatsApp/e-mail); formulário (DB6: não agora).
```html
<section class="section section--paper">
  <div class="container">
    <div class="section-head section-head--center"><h2 class="display" data-reveal-title>{{copy}}</h2></div>
    <div class="grid-2">
      <article class="card channel-card" data-card>
        <span class="channel-card__icon channel-card__icon--whats"><svg aria-hidden="true">...</svg></span>
        <h3>WhatsApp</h3><p>{{copy}}</p>
        <a class="btn btn--whatsapp" href="https://wa.me/5511930044411?text={{copy}}" target="_blank" rel="noopener">{{copy}}</a>
      </article>
      <article class="card channel-card" data-card>
        <span class="channel-card__icon channel-card__icon--mail"><svg aria-hidden="true">...</svg></span>
        <h3>E-mail</h3><p>{{copy}}</p>
        <a class="btn btn--ghost-dark" href="mailto:contato@almeidaematos.com.br">contato@almeidaematos.com.br</a>
      </article>
    </div>
  </div>
</section>
```
### 3.3 Endereço com foto + link Maps
**Classes:** `.section.section--white`, `.split`/`.split__photo` (grid foto+texto, já é exatamente esse caso).
- **390/768:** `.split` → 1 coluna (`≤860px`). **1280:** 2 colunas.

**Foto:** `recepcao-logo-sofa`, 4:3, sem overlay. **Hierarquia:** eyebrow → H2 ("Onde estamos") → endereço (mesmo NAP do footer/schema) → link "Como chegar" pro Maps. **Animação:** `data-reveal` em texto e foto.
**Não fazer:** iframe de mapa aqui (proibido — o iframe já existe no footer, não duplicar); usar só link de texto.
```html
<section class="section section--white">
  <div class="container"><div class="split">
    <div>
      <div class="section-head"><p class="eyebrow" data-reveal>{{copy}}</p><h2 class="display" data-reveal-title>{{copy: Onde estamos}}</h2></div>
      <p data-reveal>{{copy: Alameda Araguaia, 1142 · Bloco 3, 1º andar · Alphaville Industrial, Barueri (SP) · CEP 06455-000}}</p>
      <p data-reveal style="margin-top:1rem"><a class="btn btn--ghost-dark" href="https://maps.google.com/maps?q=Alameda+Araguaia,+1142+-+Alphaville+Industrial,+Barueri+-+SP" target="_blank" rel="noopener">{{copy: Como chegar}}</a></p>
    </div>
    <figure class="split__photo" data-reveal><img src="/img/escritorio/recepcao-logo-sofa-1600.webp" alt="{{copy}}" width="1600" height="1200" loading="lazy"></figure>
  </div></div>
</section>
```
### 3.4 Depois da mensagem (3 passos)
**Classes:** `.section.section--paper-2`, `.section-head`, `.steps-list` sozinho (sem `.steps-layout`, que é para 2 colunas com foto lateral — aqui não há foto).
- **390/768/1280:** `.steps-list` funciona full-width dentro do `.container`, `max-width` de leitura opcional.

**Foto:** nenhuma. **Hierarquia:** H2 → `<ol class="steps-list">` com 3 `<li>` (numeração via CSS counter). **Animação:** `data-reveal` em cada `<li>`.
**Não fazer:** `.steps-layout` (2 colunas com foto — não cabe aqui, mantém a seção compacta).
```html
<section class="section section--paper-2">
  <div class="container">
    <div class="section-head"><h2 class="display" data-reveal-title>{{copy: Depois que você manda a mensagem}}</h2></div>
    <ol class="steps-list" style="max-width:44rem">
      <li data-reveal><div><h3>{{copy}}</h3><p>{{copy}}</p></div></li>
      <li data-reveal><div><h3>{{copy}}</h3><p>{{copy}}</p></div></li>
      <li data-reveal><div><h3>{{copy}}</h3><p>{{copy}}</p></div></li>
    </ol>
  </div>
</section>
```
### 3.5 Aviso "todo o Brasil" + 3.6 Aviso anti-golpe (mesma seção)
**Classes:** `.answer-box` reaproveitado 2x (mesmo componente do hero de benefício — borda dourada, fundo branco, negrito). **Decisão:** juntar os dois avisos na mesma seção em vez de criar uma seção própria pro anti-golpe (o footer já tem `.footer__disclaimer` equivalente) — evita alongar uma página que deve ser rápida de rolar.
- **390/768/1280:** `max-width:44rem`, centralizado.

**Não fazer:** criar componente novo — `.answer-box` já resolve com zero CSS extra.
```html
<section class="section section--white">
  <div class="container" style="display:grid;gap:1rem;max-width:44rem;margin-inline:auto">
    <div class="answer-box" data-reveal><b>{{copy: Atendemos todo o Brasil pelo WhatsApp.}}</b> {{copy}}</div>
    <div class="answer-box" data-reveal><b>{{copy: Atenção a golpes em nome do escritório.}}</b> {{copy: a A&M não cobra taxa para liberar valores}}</div>
  </div>
</section>
```
### 3.7 FAQ
Igual à 2.7 (mesmas classes), perguntas de contato: atendem fora de SP? qual o horário? respondem no mesmo dia? precisa agendar pra ir ao escritório?

### 3.8 CTA final
Idêntico ao 2.8, trocando o link secundário para `/advocacia-sao-paulo/` ("Conhecer o escritório").

## 4. CSS novo necessário

Bloco novo no fim de `style.css`, comentário `/* Páginas institucionais */`:
```css
/* ============================================================
   PÁGINAS INSTITUCIONAIS (Escritório · Contato)
   ============================================================ */

/* Cartão de sócio — foto quadrada, nome, OAB, bio curta */
.founders { display: grid; grid-template-columns: repeat(2, 1fr); gap: clamp(1.6rem, 3vw, 2.6rem); max-width: 780px; margin-inline: auto; }
.founder__photo { margin: 0 0 1rem; overflow: hidden; border-radius: 8px; aspect-ratio: 1/1; background: var(--color-navy-50); }
.founder__photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
.founder h3 { font-family: var(--font-display); font-weight: 600; font-size: 1.3rem; color: var(--color-navy-800); margin-bottom: 0.2rem; }
.founder__oab { font-size: 0.88rem; color: var(--color-gold-700); font-weight: 700; margin-bottom: 0.6rem; }
.founder p:not(.founder__oab) { color: var(--color-ink-soft); font-size: 0.97rem; }

/* Grade de fotos do escritório — mosaico, 1 item largo + demais 4:3 */
.gallery { display: grid; grid-template-columns: repeat(3, 1fr); gap: clamp(0.8rem, 1.6vw, 1.2rem); }
.gallery__item { margin: 0; overflow: hidden; border-radius: 8px; border: 1px solid var(--line-soft); aspect-ratio: 4/3; }
.gallery__item img { width: 100%; height: 100%; object-fit: cover; display: block; }
.gallery__item--wide { grid-column: span 2; aspect-ratio: 16/9; }

/* Cartão de canal de contato — variante do .card com ícone circular */
.channel-card { text-align: center; }
.channel-card__icon { display: grid; place-items: center; margin: 0 auto 1rem; width: 52px; height: 52px; border-radius: 50%; }
.channel-card__icon--whats { background: rgba(37, 211, 102, 0.12); color: var(--color-whatsapp); }
.channel-card__icon--mail { background: var(--color-navy-50); color: var(--color-navy-700); }
.channel-card__icon svg { width: 26px; height: 26px; }
.channel-card .btn { margin-top: 0.9rem; }

@media (max-width: 860px) {
  .founders { grid-template-columns: 1fr; max-width: 420px; }
  .gallery { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 560px) {
  .gallery { grid-template-columns: 1fr; }
  .gallery__item--wide { grid-column: span 1; aspect-ratio: 4/3; }
}
```

Todo o resto (hero, facts, 7 cards, commit, split, answer-box, FAQ, cta-final, footer) já existe — zero CSS adicional além do bloco acima.

## 5. Imagens

| Slot | Arquivo | width/height | picture 800/1600 | loading | fetchpriority | Tratamento | Alt |
|---|---|---|---|---|---|---|---|
| Hero (ambas) | nenhuma (só `hero__mark--page` SVG) | — | — | — | — | marca vazada, opacidade 0.16 (já no CSS) | `aria-hidden` no SVG |
| Sócio 1 | `img/felipe-almeida.webp` | 800×800 (crop 1:1 se necessário) | 1 tamanho basta | `lazy` | — | nenhum | `{{copy: Felipe Almeida, sócio-fundador}}` |
| Sócio 2 | `img/fellipe-matos.webp` | 800×800 | idem | `lazy` | — | nenhum | `{{copy: Fellipe Matos, sócio-fundador}}` |
| Galeria 1 (wide) | `img/escritorio/recepcao-sofa-wide-{800,1600}.webp` | 1600×900 (crop 16:9 do 4:3 original) | sim | `lazy` | — | nenhum, `object-fit:cover` | `{{copy: Recepção com sofá e plantas}}` |
| Galeria 2 | `img/escritorio/open-office-plantas-{800,1600}.webp` | 1600×1200 | sim | `lazy` | — | nenhum | `{{copy: Open office da equipe}}` |
| Galeria 3 | `img/escritorio/equipe-reuniao-1-{800,1600}.webp` | 1600×1200 | sim | `lazy` | — | nenhum | `{{copy: Equipe em reunião}}` |
| Contato — recepção | `img/escritorio/recepcao-logo-sofa-{800,1600}.webp` | 1600×1200 | sim | `lazy` | — | nenhum (foto real, sem overlay) | `{{copy: Recepção, logo na parede}}` |

Padrão `<picture>` fora do hero (sempre `loading="lazy"`):
```html
<picture>
  <source srcset="/img/escritorio/recepcao-sofa-wide-800.webp 800w, /img/escritorio/recepcao-sofa-wide-1600.webp 1600w" sizes="(max-width:860px) 92vw, 45vw" type="image/webp">
  <img src="/img/escritorio/recepcao-sofa-wide-1600.webp" alt="{{copy}}" width="1600" height="900" loading="lazy">
</picture>
```

**Nota:** fotos do Drive vêm em 4:3 (exceto grupo). O crop do item `--wide` (16:9) deve ser feito no processamento (E2, `sips`/`cwebp`), escolhendo a foto mais "larga" (`recepcao-sofa-wide`/`open-office-wide`) pra esse slot — `object-fit:cover` resolve o excesso, mas o enquadramento visível precisa ser conferido ali. **Overlay:** nenhum — são fotos reais de ambiente sem texto sobreposto, tratamento "nenhum" preserva autenticidade.

## 6. Mobile

Ordem de empilhamento idêntica nas 2 páginas (1 coluna abaixo de 860px): nav → hero (breadcrumb → eyebrow → H1 → sub/answer-box → CTA) → cada seção completa antes da próxima, sem sobreposição de colunas (todo grid vira 1 coluna via breakpoints existentes).

- **Toque mínimo:** `.btn` já usa `padding:15px 26px` (~48px, acima do mínimo 44×44px); `.channel-card .btn` e `summary` do FAQ (`padding:18px 22px`) também cumprem.
- **`.whats-fab`:** mantido igual ao resto do site (`right/bottom:16px` em `≤560px`, já existe) — nenhum ajuste novo.
- **Comprimento do hero:** Escritório usa o padrão `.hero--page` (cabe em ~1 tela em celulares médios). Contato é mais curto ainda (3.1) — sem `answer-box` — cabe folgado até em iPhone SE.

## 7. Acessibilidade e performance

**Contraste:** nenhuma cor nova — componentes da seção 4 reusam os mesmos tokens (`--color-navy-800`/`--color-ink-soft` sobre papel/branco), já validados AA no resto do site.

**Foco:** `.btn:focus-visible` já tem outline dourado, herdado por todos os CTAs novos. Idem `.footer a`, `.card__link`.

**Landmarks:** `<header class="nav">`, `<main>`, `<footer class="footer">` copiados do molde. Seções sem heading visível levam `aria-label` (padrão: faixa de fatos já usa `aria-label="Números do escritório"`).

**`aria`:** `aria-hidden="true"` em todo SVG decorativo (marca d'água, ícones); `aria-label` no breadcrumb e na nav — copiar padrão exato do molde.

**Headings:** H1 (hero) → H2 (cada seção) → H3 (cards/sócios/passos), sem pular nível.

**Orçamento de performance:**
- Hero ≤150KB: cumprido com folga (sem foto própria, custo ~0).
- Página ≤600KB: 3 fotos de galeria (~120KB×3=360KB) + 2 fotos de sócio (~60–80KB cada) + 1 foto de recepção no Contato (~120KB) — **galeria fica em 3 itens, não 4**, pra caber no teto com folga.
- Lighthouse mobile ≥90: sem carrossel/iframe de mapa/vídeo (já fora de escopo por regra do Bernardo); fonts já pré-conectadas com `display=swap` no `<head>` do molde.

## 8. Nav e rodapé

**Copiar de `beneficios/auxilio-acidente/index.html`:** o bloco `<header class="nav" id="nav">` (L149–169) e `<div class="mobile-menu">` (L171–179) exatamente como estão — mesmos hrefs, mesmo botão WhatsApp; só trocar o `?text=` pra identificar a origem ("Vi a página do escritório..." / "...de contato...").

**Link novo "Escritório"/"Contato":**
- Nav interna: trocar `<a href="/#escritorio">Escritório</a>` por `<a href="/advocacia-sao-paulo/">Escritório</a>` nas duas páginas novas (a âncora `#escritorio` só existe na home). "Contato" pode reaproveitar o CTA de WhatsApp — não é obrigatório virar 7º item de nav (regra de `ux-patterns.md`: manter nav com <7 seções); se o Bernardo quiser, adicionar como último item antes do botão.
- **Item ativo:** usar `aria-current="page"` no `<a>` correspondente — semântico, zero CSS novo (não introduzir estado visual novo fora do escopo de reuso).
- **Rodapé (12 páginas existentes):** no bloco `<div><h4>Contato</h4><ul>` do footer (`index.html` L596–606), adicionar:
  ```html
  <li><a href="/advocacia-sao-paulo/">O escritório</a></li>
  <li><a href="/contato-advogado-sao-paulo/">Contato</a></li>
  ```
  Replicar nos 12 arquivos com `.footer__grid` (home, blog, template do post, hub, 7 benefícios, política — conforme C14 do brainstorm). Isso é trabalho de E5 (plumbing), fora desta spec — aqui só fica registrado o padrão de marcação.

## 9. Checklist de QA visual (Playwright, 390/768/1280)

Rodar nas duas páginas:

1. **390:** hero sem overflow horizontal; breadcrumb não quebra layout; CTA(s) full-width sem sobrepor `.whats-fab`; todas as grades (`facts`, `grid-3`, `founders`, `gallery`, `grid-2`, `commit`, `split`) em 1 coluna; nenhuma imagem estoura o container; FAQ abre/fecha sem cortar texto.
2. **768:** grades intermediárias corretas (`facts` 2 col, `gallery` 2 col, `grid-2` 2 col); nav ainda em modo hamburguer (breakpoint 860px); nenhum texto colidindo com foto.
3. **1280:** grades em layout desktop completo (`facts` 4 col, `grid-3` 3 col com `card--wide` na última linha, `founders` 2 col, `gallery` mosaico com item wide, `commit` 3 col, `split` 2 col); nav completa sem hamburguer; hero sem vazio excessivo em telas baixas (1366×768 — regra `@media (max-width:1024px) and (max-height:820px)` já existe).
4. **Todas as larguras:** `.whats-fab` sempre visível/clicável sem sobrepor CTA final; foco visível via Tab em todos os CTAs/nav/FAQ; nenhuma imagem 404; contraste dos componentes novos igual ao resto do site.
5. **Pós-build (`dist/`):** grep `"Voltar para o blog"` não deve aparecer (confirma que o SSG do blog não sobrescreveu a página); `<title>`/`<meta description>` corretos (não o texto cru do JSON legado); canonical aponta pra própria URL.
6. **Cross-page:** links "Escritório"/"Contato" funcionam a partir de uma amostra do rodapé (home, 1 benefício, blog) e da nav interna das 2 páginas novas; `aria-current="page"` presente no item ativo.

---

## Resumo (10 linhas)

Duas páginas institucionais no molde de `beneficios/auxilio-acidente/index.html`: nav, hero--page, FAQ, cta-final e footer copiados sem CSS novo. Escritório: hero → facts → 7 cards de áreas (cópia da home) → sócios → como trabalhamos → galeria de fotos → FAQ → CTA. Contato: hero mais curto (sem answer-box, 1 CTA só) → cartões de canal (WhatsApp/e-mail) → endereço com foto e link Maps (sem iframe) → 3 passos pós-mensagem → 2 avisos (Brasil + anti-golpe) numa seção → FAQ → CTA. CSS novo é mínimo, vai no fim de `style.css`: `.founders` (sócio), `.gallery` (3 fotos, não 4, pra caber no orçamento de 600KB) e `.channel-card` (variante de `.card`). Pasta `img/escritorio/` ainda vazia (depende de E2); fotos de sócio já existem. Sem iframe de mapa, carrossel ou vídeo. Nav troca "Escritório" de âncora para link direto; rodapé das 12 páginas ganha 2 `<li>` (E5, fora desta spec). `aria-current="page"` marca item ativo sem CSS extra. QA em Playwright 390/768/1280, com grep pós-build contra sobrescrita do SSG do blog.
