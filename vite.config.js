import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
    plugins: [
        tailwindcss(),
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
