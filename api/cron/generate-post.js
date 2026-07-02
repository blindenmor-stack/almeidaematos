// ============================================================================
// GET /api/cron/generate-post — cron diário da Vercel (padrão: 10:00 UTC = 7h BRT)
// Protegido por Authorization: Bearer ${CRON_SECRET} (a Vercel injeta o header
// automaticamente nas invocações de cron quando a env CRON_SECRET existe).
//
// O cron roda TODO dia; a frequência semanal é controlada pelas settings:
//   - enabled=false           → skip
//   - hoje ∉ publish_days     → skip (dia da semana em America/Sao_Paulo)
//   - já gerou post hoje      → skip (consulta blog_generation_log)
// ============================================================================

import { timingSafeEqual, createHash } from 'node:crypto';
import { getSettings, sbFetch, logGeneration } from '../_lib/supabase.js';
import { generatePost } from '../_lib/generate.js';
import { nowInSaoPaulo, sendError } from '../_lib/util.js';

// Geração via Gemini pode demorar — estende o timeout da function
export const config = { maxDuration: 300 };

const WEEKDAYS_PT = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** Valida o Bearer do cron em tempo constante. */
function isAuthorized(req) {
    const secret = process.env.CRON_SECRET;
    if (!secret) return false;
    const auth = String(req.headers['authorization'] || '');
    const expected = `Bearer ${secret}`;
    const ha = createHash('sha256').update(auth).digest();
    const hb = createHash('sha256').update(expected).digest();
    return timingSafeEqual(ha, hb);
}

/** Registra um skip no log e responde 200 (skip não é erro pro cron). */
async function skip(res, detail) {
    await logGeneration({ trigger_source: 'cron', status: 'skipped', detail });
    return res.status(200).json({ ok: true, skipped: true, reason: detail });
}

export default async function handler(req, res) {
    try {
        if (!isAuthorized(req)) {
            return sendError(res, 401, 'Não autorizado');
        }

        // 1. Settings: sistema ligado?
        const settings = await getSettings();
        if (!settings.enabled) {
            return skip(res, 'Sistema desativado nas settings (enabled=false)');
        }

        // 2. Hoje é dia de publicar? (fuso America/Sao_Paulo)
        const sp = nowInSaoPaulo();
        const publishDays = Array.isArray(settings.publish_days) ? settings.publish_days : [1, 3, 5];
        if (!publishDays.includes(sp.weekday)) {
            return skip(res, `Hoje é ${WEEKDAYS_PT[sp.weekday]} — dias de publicação: ${publishDays.map((d) => WEEKDAYS_PT[d]).join(', ')}`);
        }

        // 3. Já gerou post hoje? (consulta o log a partir da meia-noite BRT)
        //    'YYYY-MM-DDT00:00:00-03:00' cobre o dia civil de São Paulo.
        const startOfDaySP = `${sp.ymd}T00:00:00-03:00`;
        const todayRuns = await sbFetch(
            `blog_generation_log?trigger_source=eq.cron&status=eq.success&run_at=gte.${encodeURIComponent(startOfDaySP)}&select=id&limit=1`
        );
        if (todayRuns && todayRuns.length) {
            return skip(res, `Post do dia já foi gerado (${sp.ymd})`);
        }

        // 3b. Limite semanal (posts_per_week) — conta gerações de sucesso do
        //     cron desde a segunda-feira da semana corrente (00:00 BRT).
        const postsPerWeek = Number(settings.posts_per_week) || 3;
        const daysSinceMonday = (sp.weekday + 6) % 7; // seg=0 ... dom=6
        const monday = new Date(`${sp.ymd}T00:00:00-03:00`);
        monday.setUTCDate(monday.getUTCDate() - daysSinceMonday);
        const mondayYmd = monday.toISOString().slice(0, 10);
        const weekRuns = await sbFetch(
            `blog_generation_log?trigger_source=eq.cron&status=eq.success&run_at=gte.${encodeURIComponent(`${mondayYmd}T00:00:00-03:00`)}&select=id&limit=20`
        );
        if (weekRuns && weekRuns.length >= postsPerWeek) {
            return skip(res, `Limite semanal atingido (${weekRuns.length}/${postsPerWeek} posts desde ${mondayYmd})`);
        }

        // 4-7. Gera (pauta → Gemini → valida → insere → marca pauta → loga)
        const { post, topic, words } = await generatePost({ triggerSource: 'cron' });

        return res.status(200).json({
            ok: true,
            post: {
                id: post.id,
                title: post.title,
                slug: post.slug,
                status: post.status,
                words,
            },
            topic: topic.topic,
            url: post.status === 'published' ? `https://almeidaematos.com.br/${post.slug}/` : null,
        });
    } catch (err) {
        console.error('api/cron/generate-post:', err);
        // generatePost já logou o erro no generation_log
        return sendError(res, 500, 'Falha na geração agendada', err.message);
    }
}
