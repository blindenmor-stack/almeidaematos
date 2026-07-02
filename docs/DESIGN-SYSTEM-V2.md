# Design System — Site A&M v2

> Fonte da verdade visual da v2. Derivado do **Manual da Marca Almeida & Matos** (Arbo Criativa) + CONTEXTO_MESTRE.md.
> Toda decisão visual/copy dos agentes de implementação valida contra este doc.

---

## 1. Fundamento da marca

**Símbolo:** duas "montanhas" (letras A+M) formadas por triângulos sobrepostos em navy, dourado e cinza.
**Gramática visual do manual:** linhas retas, triângulos, cortes diagonais.
**Aplicações-assinatura observadas no manual:**
1. **Marca d'água triangular gigante** (papelaria) → usar como elemento parallax de fundo nas seções
2. **Corte diagonal** (base de post: triângulo navy cortando o canto da imagem) → divisores de seção com clip-path
3. **Bloco navy + filete dourado** (placas internas) → padrão de cabeçalho de card/seção
4. **Faixa dourada horizontal fina no topo** (fundo de apresentações) → borda superior do site
5. **Triângulo dividido meio-a-meio azul/dourado** (pasta) → motif de hover/reveal

**Posicionamento (CONTEXTO_MESTRE):** "Central de resolução jurídica integral de acidentes". Promessa: *"Mais do que um benefício do INSS, um recomeço de vida."* Tom: simples, direto, empático, autoridade professor/guia. Compliance OAB: educar > vender, sem "ligue já", sem promessa de resultado, CTAs discretos.

---

## 2. Cor

Cores oficiais do manual: navy `#354271` · dourado `#D2AE6D` · cinza `#848688`.
Escalas derivadas mantendo o hue oficial (o site v1 usava um navy quase-preto fora da marca — a v2 corrige):

```css
@theme {
  /* Navy — hue do #354271 oficial */
  --color-navy-950: #0D1226;  /* fundo dark profundo */
  --color-navy-900: #141B38;  /* fundo dark padrão */
  --color-navy-800: #1F2A52;  /* superfícies dark elevadas */
  --color-navy-700: #354271;  /* ★ COR OFICIAL — blocos, headings */
  --color-navy-600: #43538C;
  --color-navy-500: #5566A6;
  --color-navy-300: #97A3CC;
  --color-navy-100: #DFE3F0;
  --color-navy-50:  #F0F2F8;

  /* Gold — hue do #D2AE6D oficial */
  --color-gold-700: #8F7340;
  --color-gold-600: #B8935A;
  --color-gold-500: #D2AE6D;  /* ★ COR OFICIAL — CTAs, filetes, acentos */
  --color-gold-300: #E2C893;
  --color-gold-200: #F0E2C4;
  --color-gold-100: #F8F1E1;

  /* Neutros */
  --color-gray-500: #848688;  /* ★ COR OFICIAL — texto secundário em claro */
  --color-paper:    #F7F5F0;  /* off-white quente — fundos claros */
  --color-paper-2:  #EFECE4;  /* off-white nível 2 */
  --color-ink:      #10162E;  /* texto em fundo claro */

  --color-whatsapp: #25D366;
}
```

**Regras:**
- Seções alternam **dark navy** (900/950) ↔ **paper** com transições diagonais.
- Dourado NUNCA como fundo de área grande — é acento (filetes, CTAs, números, keywords em headlines).
- Gradiente-assinatura de texto: `linear-gradient(120deg, #E2C893, #D2AE6D, #B8935A)` para a palavra-chave da headline (1 por seção, no máximo).
- Contraste AA mínimo: texto body em dark = `#DFE3F0`+; em claro = `#10162E` / `#3A4258`.

## 3. Tipografia

- **Display (headlines):** `Archivo` variable (weight 500–900 + width axis) — headlines em **Archivo Expanded 800/900**, tracking apertado (-0.02em). Geometria forte que conversa com os triângulos do logo. Uppercase apenas em eyebrows/labels.
- **Body:** `Plus Jakarta Sans` (400/500/600/700) — humanista-geométrica, próxima do espírito do logo (New Tai Lue), já usada no site (continuidade + zero risco).
- Escala fluida (clamp): h1 `clamp(2.5rem, 6vw, 4.75rem)` · h2 `clamp(2rem, 4.5vw, 3.25rem)` · h3 `clamp(1.25rem, 2.2vw, 1.625rem)` · body `1rem/1.0625rem` · eyebrow `0.8125rem` uppercase tracking `0.18em`.
- Line-height: display 1.05–1.15; body 1.6–1.75.
- Números/estatísticas: Archivo 800 tabular.

## 4. Gramática de formas (CSS)

- **Divisor diagonal de seção:** `clip-path: polygon(0 0, 100% 0, 100% calc(100% - clamp(3rem,8vw,7rem)), 0 100%)` (e espelhado). Ângulo consistente ~6–8°.
- **Filete dourado:** `height: 3px; background: var(--color-gold-500)` — sob eyebrows, no topo de cards, sob a nav. Anima de `scaleX(0)` a `scaleX(1)` (origin left).
- **Marca d'água triangular:** SVG do símbolo A&M (outline ou fill a 4–6% de opacidade) posicionado grande nas seções, parallax lento via GSAP.
- **Corte de imagem:** imagens institucionais com `clip-path` de canto diagonal (triângulo navy sobreposto no canto inferior, como no manual).
- **Cards:** fundo elevado, borda 1px sutil, filete dourado no topo OU triângulo pequeno no canto que expande no hover.

## 5. Sistema de animação (GSAP 3 + ScrollTrigger + Lenis — já no projeto)

Princípio: **retas, diagonais e triângulos em movimento**. Nada de bounce/elastic fofos — easing sóbrio e preciso (`power3.out`, `power4.inOut`). Durations 0.6–1.2s.

Catálogo v2:
1. **Preloader** (primeira visita, ≤1.6s, sessionStorage pra não repetir): triângulo A&M desenhado por stroke SVG + contagem sutil, sai com wipe diagonal revelando o hero.
2. **Hero reveal:** headline linha-a-linha com máscara (translateY 110% → 0, stagger 80ms), filete dourado desenha, foto dos sócios com clip-path reveal diagonal, badges com fade-up.
3. **Split headline reveal** (todas as h2): palavras mascaradas, stagger; keyword dourada com gradiente.
4. **Divisores diagonais vivos:** leve parallax de background entre seções (`yPercent` via scrub).
5. **Contadores** (11+ anos, 10.000+ clientes, 70+ colaboradores): count-up com snap, disparo a 60% do viewport.
6. **Cards em cascata:** fade-up + stagger 90ms; hover com filete que cresce e triângulo de canto.
7. **Image reveals:** clip-path `polygon` de fechado→aberto na diagonal, com escala 1.08→1.
8. **Marca d'água parallax:** triângulo gigante `yPercent: -12` scrub.
9. **Linha do processo (4 passos):** linha dourada que se desenha conectando os passos (stroke-dashoffset scrub).
10. **Marquee sóbrio** de áreas de atuação/prova social no rodapé do hero (duplicado, pausa em hover).
11. **Magnetic CTA** (desktop): deslocamento sutil ≤8px, spring rápido.
12. **Nav:** esconde ao rolar pra baixo, mostra ao subir; fundo blur ao passar de 50px; filete dourado inferior.

**Performance/a11y (obrigatório):**
- `gsap.matchMedia()`: mobile recebe versão reduzida (sem parallax, sem magnetic, reveals simples).
- `@media (prefers-reduced-motion: reduce)` → tudo instantâneo (padrão já existente no site, manter).
- Animar SÓ `transform`/`opacity`/`clip-path`. `will-change` cirúrgico. Sem layout thrash.
- Lenis com `syncTouch: false` (nativo no touch), integração ScrollTrigger via `lenis.on('scroll', ScrollTrigger.update)` + ticker.

## 6. Estrutura de páginas (URLs)

**Preservar (SEO — inegociável):** `/` · `/blog/` · 491 posts em `/{slug}/` · todos os redirects 301 do vercel.json.

**Novas:**
- `/beneficios/` — hub dos produtos
- `/beneficios/auxilio-acidente/` (produto estrela)
- `/beneficios/auxilio-doenca/` · `/beneficios/bpc-loas/` · `/beneficios/aposentadoria-por-invalidez/` · `/beneficios/pensao-por-morte/` · `/beneficios/aposentadoria-pcd/` · `/beneficios/indenizacao-civel-trabalhista/`
- `/admin/` (painel do blog, noindex, senha)

**Template de página de produto:** hero curto (pergunta-dor + resposta direta answer-first) → quem tem direito (checklist) → documentos necessários (accordion/checklist) → como funciona (4 passos) → 3 esferas quando aplicável → FAQ (schema FAQPage) → CTA WhatsApp com risk-reducer. Breadcrumb + BreadcrumbList schema.

## 7. Copy (regras)

- Framework PAS nas landings; answer-first no 1º parágrafo (AEO).
- Mensagens validadas do CONTEXTO_MESTRE ("INSS é seguro, não é favor", "Voltou a trabalhar? Não impede auxílio-acidente", "Se não ganhar, não paga nada").
- Você > nós. Específico > vago ("11 anos", "10.000+ clientes", "70+ colaboradores").
- CTAs: "Fale com um especialista" + risk-reducer "Sem custo. Sem compromisso." — 1 CTA primário por seção.
- Compliance OAB: educar, tom sóbrio, sem urgência artificial, sem promessa de resultado, sem valores de casos.

## 8. Performance budget

- JS total ≤ 90KB gzip (GSAP+Lenis ~55KB já contam), CSS ≤ 45KB gzip.
- Imagens: WebP/AVIF, `loading="lazy"` abaixo da dobra, `fetchpriority="high"` no hero, srcset.
- Fonts: 2 famílias via Google Fonts, `display=swap`, preconnect.
- LCP < 2.0s · CLS < 0.05 · INP < 200ms (mobile 4G).
