# SPEC — Globo 3D "Atendemos o Brasil inteiro" (globe.js)

> Substitui o mapa 2D (`brasil-map.js`) na seção `#brasil` da home. Meta: mais fluido
> que o globo do stripe.com/br. Canvas 2D puro (SEM three.js — peso proibido).
> A palavra-chave é SUAVIDADE: nenhum valor visual muda instantaneamente — tudo
> converge por lerp/damping. A versão atual é "seca" porque estados ligam/desligam;
> a nova interpola tudo.

## Dados (`public/geo/globe-data.json`, gerado por script, quantizado)
```json
{
  "world": [[lat*100, lon*100], ...],        // ~2100 pontos int, terra exceto Brasil, passo ~1.6°
  "brazil": [[lat*100, lon*100, ufIndex], ...], // ~1400 pontos, passo ~0.55°, cada um com índice do estado
  "ufs": [{"name": "São Paulo", "uf": "SP", "lat": -22.2, "lon": -48.7}, ...27]  // centroides
}
```
Fontes: world-atlas land-110m (jsdelivr) + GeoJSON dos estados do IBGE (github). Ponto-em-polígono
com todos os rings. Jitter de ±0.15° pra tirar cara de grade.

## Projeção e rotação
- Esfera unitária: `v = (cosφ·sinλ, sinφ, cosφ·cosλ)` com φ=lat, λ=lon (pré-computado 1x em Float32Array).
- Por frame: rotação yaw (Y) + pitch (X) — 4 sin/cos por frame, aplicados a todos os pontos.
- Projeção ortográfica: `sx = cx + x·R`, `sy = cy − y·R`; `z` guia profundidade.
- **Depth suave**: alpha = smoothstep(-0.15, 0.25, z) mapeado em [0.05, 1] — o verso do globo
  fica visível a 5% (volume), sem corte seco no horizonte.
- Disco do globo: gradiente radial sutil (navy-800 centro → navy-950 borda) + rim light dourado
  fraquíssimo no limbo (1px glow). Nada de "wireframe".

## Motion design (o que faz ser melhor que o Stripe)
Estado interno com alvos e valores correntes (TUDO lerp):
- `yaw`: auto-rotação contínua `yawVel = 0.0016 rad/frame` base.
- **Drag** (pointer): arrasto altera yaw/pitch diretamente (1:1 com sensação de peso,
  fator 0.005/px), guarda velocity; ao soltar, inércia com damping 0.94/frame; a
  auto-rotação retorna com crossfade de 2s (lerp do peso auto vs inércia).
- **Hover parallax** (sem drag): pitch alvo = pitchBase + mouseYnorm·0.06; yawVel alvo
  ganha ±20% conforme mouseX (o globo "acompanha" o olhar). Lerp 0.05.
- Pitch base: −0.32 rad (mostra o hemisfério sul confortavelmente).
- Yaw inicial: Brasil de frente (lon −53° centrado). Entrada da seção (ScrollTrigger once):
  globo sobe 24px→0, escala 0.94→1, alpha 0→1, 1.1s power3.out; e yaw dá um "settle"
  de −0.35 rad até o alvo com power2.out (chega girando de leve).
- Cursor: `grab`/`grabbing` durante drag.
- Touch: swipe horizontal gira com a mesma inércia (touch-action: pan-y pra não travar scroll).

## Brasil e estados
- Dots do mundo: `rgba(151,163,204,α·0.34)`, r 1.0–1.6.
- Dots do Brasil: dourado `rgba(210,174,109,α·0.9)`, r 1.3–2.0 — o Brasil é o protagonista luminoso.
- Cada dot do Brasil tem `glow ∈ [0,1]` corrente (lerp 0.08 por frame para o alvo):
  quando um arco chega no estado, os dots do UF ganham alvo 1 com **stagger radial**
  a partir do centroide (onda de acendimento ~400ms), seguram 1.8s e voltam a alvo 0 —
  o decaimento é o lerp, então o desligamento é um fade orgânico, nunca seco.
- Dot glow: soma brilho (alpha→1, r +60%, cor gold-300) proporcional ao `glow`.

## Arcos (SP → estados)
- Origem fixa: São Paulo (−23.55, −46.63), marcador pulsante dourado + badge "São Paulo · HQ".
- Sequência: fila embaralhada dos 26 UFs restantes; 2–3 arcos simultâneos, lançamento a cada ~1.1s.
- Trajetória 3D: slerp entre vetores origem/destino com elevação radial `1 + 0.10·sin(π·t)` —
  projetada POR FRAME (o arco gruda no globo e acompanha rotação/drag).
- Desenho: cabeça = pulso dourado com shadowBlur 12; rastro dos últimos 34% com gradiente
  de alpha (stroke 1.3px); passagem pelo verso do globo herda o depth-alpha.
- Chegada: anel expandindo (raio 3→16, alpha 0.7→0) + onda de glow no estado + badge.

## Badges (espaçamento novo)
- Leader line: linha 1px dourada 40% do ponto até o badge (12px de comprimento, diagonal 45°
  pra cima/fora, lado escolhido pra caber no canvas).
- Caixa: padding 9px×14px, radius 6, fundo rgba(13,18,38,0.92), borda rgba(210,174,109,0.5),
  texto 11.5px Plus Jakarta Sans 600 branco; nome do ESTADO (ex "Minas Gerais").
- Entrada: alpha 0→1 + scale 0.86→1 (transform via ctx) com overshoot suave (easeOutBack 1.2), 260ms.
- Saída: fade 300ms. Vida total ~2.4s. Máximo 3 badges simultâneos; badge some se o ponto
  rotacionar pro verso (z < 0.05) com fade rápido.
- Nunca colar na borda: clamp com margem 10px.

## Performance
- Float32Array pros vetores base; zero alocação por frame (buffers reutilizados).
- gsap.ticker como único loop; IntersectionObserver liga/desliga; `document.hidden` pausa.
- DPR cap 2. Mobile (<560px): usa metade dos pontos do mundo (stride 2), sem hover parallax.
- Canvas ~720px máx, aspect 1:1. Redraw só quando running.
- Orçamento: ≤4ms/frame em M2 (medir com performance.now no dev).

## Acessibilidade
- prefers-reduced-motion: frame estático (Brasil de frente, todos os estados levemente acesos), sem loop.
- aria-label no canvas. Sem informação exclusiva na animação.

## Copy da seção (substitui a atual)
- eyebrow: `Cobertura nacional`
- H2: `Atendemos o Brasil inteiro.` (gold-word em "Brasil inteiro.")
- lead: `Atendimento 100% digital em todos os estados — do primeiro contato à conclusão do processo.`
- micro (btn-note): `Processo eletrônico no INSS e na Justiça: seu caso anda sem você sair de casa.`
- FIX de contraste: criar regra `.section--darker .lead { color: var(--color-navy-100); }`
  (a seção usa --darker e o lead caía no cinza de fundo claro — bug atual).

## Integração
- `globe.js` exporta `initGlobe({ prefersReduced })`; main.js troca a chamada do brasil-map.
- `brasil-map.js` morre (deletar) junto com referências.
- Canvas id continua `brasilCanvas` (CSS `.brasil-map` mantém, height = width via JS).
- Fetch do JSON: `/geo/globe-data.json` com cache immutable (public/), fallback: se falhar,
  esconde a seção sem erro no console.
