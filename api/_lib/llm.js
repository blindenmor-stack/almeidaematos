// ============================================================================
// LLM multi-provider — Gemini (Google), Claude (Anthropic) e GPT (OpenAI).
// Todos com saída JSON estruturada validável pelo mesmo responseSchema
// (formato Gemini: {type:'OBJECT'|'STRING'|'ARRAY', properties, items, required}).
//
// O provider é escolhido pelo PREFIXO do nome do modelo:
//   gemini-* / nano-*  → GEMINI_API_KEY
//   claude-*           → ANTHROPIC_API_KEY
//   gpt-* / o*         → OPENAI_API_KEY
//
// Se a env do provider escolhido não existir, cai para o Gemini (que é a
// env básica do sistema) com log — o cron nunca quebra por chave faltando.
// ============================================================================

const GEMINI_FALLBACK = 'gemini-pro-latest';

/** Converte o schema estilo Gemini para JSON Schema padrão (Anthropic/OpenAI). */
function toJsonSchema(s) {
    if (!s) return undefined;
    const t = String(s.type || 'OBJECT').toLowerCase();
    const out = { type: t };
    if (s.description) out.description = s.description;
    if (t === 'object') {
        out.properties = {};
        for (const [k, v] of Object.entries(s.properties || {})) out.properties[k] = toJsonSchema(v);
        if (s.required) out.required = s.required;
        out.additionalProperties = false;
    }
    if (t === 'array' && s.items) out.items = toJsonSchema(s.items);
    return out;
}

function providerFor(model) {
    if (/^claude-/.test(model)) return 'anthropic';
    if (/^(gpt-|o\d)/.test(model)) return 'openai';
    return 'gemini';
}

async function callGeminiApi({ model, prompt, responseSchema }) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY não configurada');
    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    responseMimeType: 'application/json',
                    responseSchema,
                    temperature: 0.7,
                },
            }),
        }
    );
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini: resposta sem texto');
    return JSON.parse(text);
}

async function callAnthropic({ model, prompt, responseSchema }) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('ANTHROPIC_API_KEY não configurada');
    // Tool use força a saída no schema — o input do tool É o artigo.
    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model,
            max_tokens: 16000,
            messages: [{ role: 'user', content: prompt }],
            tools: [{
                name: 'entregar_resultado',
                description: 'Entrega o resultado estruturado no formato exigido.',
                input_schema: toJsonSchema(responseSchema),
            }],
            tool_choice: { type: 'tool', name: 'entregar_resultado' },
        }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const block = (data.content || []).find((b) => b.type === 'tool_use');
    if (!block?.input) throw new Error('Anthropic: resposta sem tool_use');
    return block.input;
}

async function callOpenAI({ model, prompt, responseSchema }) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY não configurada');
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            response_format: {
                type: 'json_schema',
                json_schema: { name: 'resultado', strict: true, schema: toJsonSchema(responseSchema) },
            },
        }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('OpenAI: resposta sem conteúdo');
    return JSON.parse(text);
}

/**
 * Chama o LLM certo pro modelo pedido, com fallback pro Gemini quando a
 * chave do provider não está configurada no ambiente.
 * Retorna o objeto JSON já parseado/validado pelo provider.
 */
export async function callLLM({ model, prompt, responseSchema }) {
    const provider = providerFor(model);
    const hasKey = {
        gemini: !!process.env.GEMINI_API_KEY,
        anthropic: !!process.env.ANTHROPIC_API_KEY,
        openai: !!process.env.OPENAI_API_KEY,
    }[provider];

    if (!hasKey && provider !== 'gemini') {
        console.warn(`[llm] ${model} requer chave de ${provider} ausente — fallback ${GEMINI_FALLBACK}`);
        return { result: await callGeminiApi({ model: GEMINI_FALLBACK, prompt, responseSchema }), modelUsed: GEMINI_FALLBACK };
    }

    const fn = { gemini: callGeminiApi, anthropic: callAnthropic, openai: callOpenAI }[provider];
    return { result: await fn({ model, prompt, responseSchema }), modelUsed: model };
}
