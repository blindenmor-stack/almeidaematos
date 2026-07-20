import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

// Microsoft Clarity (heatmaps + gravação de sessão). Injetado por plugin em vez
// de colado em cada HTML: são 11 entradas + os ~491 posts do SSG, que herdam do
// blog-post.html buildado. Página nova entra no input abaixo e já nasce com ele.
// Os posts servidos pela function (/api/blog/post) têm cópia própria em
// api/_lib/template.js — se trocar o ID, trocar nos DOIS lugares.
const CLARITY_ID = 'xpeqwvizm1'

const CLARITY_SNIPPET = `(function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "${CLARITY_ID}");`

/** Injeta o Clarity no <head> de toda página HTML processada pelo Vite. */
function clarityPlugin() {
    return {
        name: 'inject-clarity',
        transformIndexHtml() {
            return [{ tag: 'script', children: CLARITY_SNIPPET, injectTo: 'head' }]
        },
    }
}

export default defineConfig({
    plugins: [
        tailwindcss(),
        clarityPlugin(),
    ],
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                blog: resolve(__dirname, 'blog/index.html'),
                blogPost: resolve(__dirname, 'blog-post.html'),
                // Hub + páginas de benefícios (v2)
                beneficios: resolve(__dirname, 'beneficios/index.html'),
                auxilioAcidente: resolve(__dirname, 'beneficios/auxilio-acidente/index.html'),
                auxilioDoenca: resolve(__dirname, 'beneficios/auxilio-doenca/index.html'),
                bpcLoas: resolve(__dirname, 'beneficios/bpc-loas/index.html'),
                aposentadoriaInvalidez: resolve(__dirname, 'beneficios/aposentadoria-por-invalidez/index.html'),
                pensaoMorte: resolve(__dirname, 'beneficios/pensao-por-morte/index.html'),
                aposentadoriaPcd: resolve(__dirname, 'beneficios/aposentadoria-pcd/index.html'),
                indenizacao: resolve(__dirname, 'beneficios/indenizacao-civel-trabalhista/index.html'),
                // (admin/ é estático puro — copiado no script de build, fora do bundle Vite)
            },
        },
    },
})
