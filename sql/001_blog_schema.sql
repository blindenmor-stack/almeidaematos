-- ============================================================================
-- BLOG AUTOMATIZADO — Almeida & Matos Advogados
-- Migração 001: schema completo do blog (idempotente — pode rodar mais de 1x)
-- ============================================================================
--
-- COMO ATIVAR (passo a passo):
--
-- 1. Cole este arquivo inteiro no SQL Editor do dashboard Supabase
--    (https://supabase.com/dashboard → projeto do CRM → SQL Editor → Run).
--
-- 2. Exponha o schema `aquisicao` na API REST:
--    Dashboard → Settings → API → "Exposed schemas" → adicionar `aquisicao`
--    à lista (junto de `public`). Sem isso o PostgREST retorna 406.
--
-- 3. Crie as env vars no projeto da Vercel (Settings → Environment Variables):
--    SUPABASE_URL        = https://argvppsbnoeyozjepagb.supabase.co
--    SUPABASE_SECRET_KEY = (service_role key — Settings → API no Supabase)
--    GEMINI_API_KEY      = (chave do Google AI Studio)
--    ADMIN_PASSWORD      = (senha do painel /admin)
--    CRON_SECRET         = (string aleatória longa — protege o cron)
--
-- 4. Detalhes de cron/rewrites no vercel.json: ver docs/BLOG-SYSTEM.md
-- ============================================================================

create schema if not exists aquisicao;

-- Extensão para gen_random_uuid (já vem habilitada no Supabase, mas garante)
create extension if not exists pgcrypto;

-- ============================================================================
-- 1. blog_posts — os artigos (gerados por IA ou manuais)
-- ============================================================================
create table if not exists aquisicao.blog_posts (
    id               uuid primary key default gen_random_uuid(),
    title            text not null,
    slug             text unique not null,
    excerpt          text,
    content_html     text,
    category         text,
    category_slug    text,
    author           text default 'Equipe Almeida & Matos',
    read_time        text,
    status           text not null default 'draft'
                     check (status in ('draft', 'scheduled', 'published', 'archived')),
    origin           text not null default 'ai'
                     check (origin in ('ai', 'manual')),
    meta_title       text,
    meta_description text,
    -- faq: array JSON de {question, answer} — vira schema FAQPage + bloco visível
    faq              jsonb,
    -- internal_links: links internos sugeridos/aplicados (auditoria)
    internal_links   jsonb,
    target_keyword   text,
    scheduled_for    timestamptz,
    published_at     timestamptz,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create index if not exists blog_posts_slug_idx         on aquisicao.blog_posts (slug);
create index if not exists blog_posts_status_idx       on aquisicao.blog_posts (status);
create index if not exists blog_posts_published_at_idx on aquisicao.blog_posts (published_at desc);

-- Trigger de updated_at
create or replace function aquisicao.set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists blog_posts_set_updated_at on aquisicao.blog_posts;
create trigger blog_posts_set_updated_at
    before update on aquisicao.blog_posts
    for each row execute function aquisicao.set_updated_at();

-- ============================================================================
-- 2. blog_settings — singleton de configuração (linha editorial, cadência)
-- ============================================================================
create table if not exists aquisicao.blog_settings (
    id                 int primary key default 1 check (id = 1),
    enabled            boolean not null default true,
    posts_per_week     int not null default 3,
    -- Dias de publicação: 0=domingo .. 6=sábado (padrão seg/qua/sex)
    publish_days       int[] not null default '{1,3,5}',
    -- Hora de publicação em BRT (informativo — o cron da Vercel dita o horário real)
    publish_hour       int not null default 7,
    -- true = publica direto; false = gera como draft para revisão humana
    auto_publish       boolean not null default true,
    editorial_line     text,
    tone               text,
    extra_instructions text,
    model              text not null default 'gemini-2.5-flash',
    updated_at         timestamptz not null default now()
);

drop trigger if exists blog_settings_set_updated_at on aquisicao.blog_settings;
create trigger blog_settings_set_updated_at
    before update on aquisicao.blog_settings
    for each row execute function aquisicao.set_updated_at();

-- ============================================================================
-- 3. blog_topics — fila de pautas
-- ============================================================================
create table if not exists aquisicao.blog_topics (
    id             uuid primary key default gen_random_uuid(),
    topic          text not null,
    target_keyword text,
    category       text,
    category_slug  text,
    -- product_slug liga a pauta à página de produto /beneficios/{slug}/
    product_slug   text,
    priority       int not null default 5,
    status         text not null default 'pending'
                   check (status in ('pending', 'used', 'discarded')),
    notes          text,
    created_at     timestamptz not null default now(),
    used_at        timestamptz
);

create index if not exists blog_topics_status_priority_idx
    on aquisicao.blog_topics (status, priority desc);

-- ============================================================================
-- 4. blog_generation_log — auditoria de cada rodada de geração
-- ============================================================================
create table if not exists aquisicao.blog_generation_log (
    id             uuid primary key default gen_random_uuid(),
    run_at         timestamptz not null default now(),
    trigger_source text,          -- 'cron' | 'manual'
    topic_id       uuid,
    post_id        uuid,
    status         text,          -- 'success' | 'error' | 'skipped'
    detail         text,
    model          text,
    duration_ms    int
);

create index if not exists blog_generation_log_run_at_idx
    on aquisicao.blog_generation_log (run_at desc);

-- ============================================================================
-- 5. GRANTs + RLS
--    O front NUNCA acessa essas tabelas direto — tudo passa pelas Vercel
--    Functions com a service_role key. RLS ligado com policy só p/ service_role.
-- ============================================================================
grant usage on schema aquisicao to service_role;
grant all on all tables in schema aquisicao to service_role;
grant all on all sequences in schema aquisicao to service_role;
alter default privileges in schema aquisicao grant all on tables to service_role;
alter default privileges in schema aquisicao grant all on sequences to service_role;

alter table aquisicao.blog_posts          enable row level security;
alter table aquisicao.blog_settings       enable row level security;
alter table aquisicao.blog_topics         enable row level security;
alter table aquisicao.blog_generation_log enable row level security;

-- service_role bypassa RLS por padrão, mas as policies explícitas documentam
-- a intenção e protegem caso alguém exponha anon/authenticated no futuro.
drop policy if exists blog_posts_service_role on aquisicao.blog_posts;
create policy blog_posts_service_role on aquisicao.blog_posts
    for all to service_role using (true) with check (true);

drop policy if exists blog_settings_service_role on aquisicao.blog_settings;
create policy blog_settings_service_role on aquisicao.blog_settings
    for all to service_role using (true) with check (true);

drop policy if exists blog_topics_service_role on aquisicao.blog_topics;
create policy blog_topics_service_role on aquisicao.blog_topics
    for all to service_role using (true) with check (true);

drop policy if exists blog_generation_log_service_role on aquisicao.blog_generation_log;
create policy blog_generation_log_service_role on aquisicao.blog_generation_log
    for all to service_role using (true) with check (true);

-- ============================================================================
-- 6. SEED — settings default + pautas iniciais
-- ============================================================================
insert into aquisicao.blog_settings (id, editorial_line, tone)
values (
    1,
    'Blog educativo sobre direito previdenciário e acidentário para trabalhadores brasileiros que sofreram acidente ou têm alguma incapacidade. Foco em responder dúvidas reais de forma direta (answer-first), com prioridade para auxílio-acidente (produto estrela), auxílio-doença, BPC/LOAS, aposentadoria por invalidez, pensão por morte, aposentadoria PCD e indenizações cíveis/trabalhistas. Sempre educar antes de vender, citando a legislação correta (Lei 8.213/91, LC 142/2013, Lei 8.742/93).',
    'Advogado-educador: simples, direto, empático. Fala com "você", explica termos técnicos, nunca promete resultado, nunca cria urgência artificial.'
)
on conflict (id) do nothing;

-- Pautas iniciais (18) — auxílio-acidente com mais peso (produto estrela).
-- ON CONFLICT não se aplica (sem unique em topic), então protege com WHERE NOT EXISTS.
insert into aquisicao.blog_topics (topic, target_keyword, category, category_slug, product_slug, priority)
select * from (values
    -- Auxílio-acidente (6 pautas — produto estrela)
    ('Auxílio-acidente para quem voltou a trabalhar: por que o benefício continua sendo devido', 'auxílio-acidente voltou a trabalhar', 'Auxílio Acidente', 'auxilio-acidente', 'auxilio-acidente', 10),
    ('Diferença entre auxílio-doença e auxílio-acidente: qual é o seu caso?', 'diferença auxílio-doença e auxílio-acidente', 'Auxílio Acidente', 'auxilio-acidente', 'auxilio-acidente', 9),
    ('Auxílio-acidente negado pelo INSS: o que fazer e como recorrer', 'auxílio-acidente negado o que fazer', 'Auxílio Acidente', 'auxilio-acidente', 'auxilio-acidente', 9),
    ('Sequela de acidente de trabalho: quando ela dá direito ao auxílio-acidente', 'sequela acidente de trabalho auxílio-acidente', 'Auxílio Acidente', 'auxilio-acidente', 'auxilio-acidente', 8),
    ('Auxílio-acidente para acidente de trajeto: casa-trabalho conta?', 'auxílio-acidente acidente de trajeto', 'Auxílio Acidente', 'auxilio-acidente', 'auxilio-acidente', 8),
    ('Quanto é o valor do auxílio-acidente e como ele é calculado', 'valor do auxílio-acidente', 'Auxílio Acidente', 'auxilio-acidente', 'auxilio-acidente', 8),
    -- Auxílio-doença (3)
    ('Documentos para dar entrada no auxílio-doença em 2026: checklist completo', 'documentos auxílio-doença', 'Benefícios INSS', 'beneficios-inss', 'auxilio-doenca', 7),
    ('Perícia do INSS para auxílio-doença: como funciona e como se preparar', 'perícia INSS auxílio-doença', 'Benefícios INSS', 'beneficios-inss', 'auxilio-doenca', 7),
    ('Auxílio-doença negado por falta de qualidade de segurado: o que significa e como reverter', 'qualidade de segurado auxílio-doença', 'Benefícios INSS', 'beneficios-inss', 'auxilio-doenca', 6),
    -- BPC/LOAS (3)
    ('BPC LOAS: renda familiar acima do limite ainda dá direito?', 'BPC LOAS renda familiar acima do limite', 'BPC LOAS', 'bpc-loas', 'bpc-loas', 7),
    ('BPC LOAS para deficiência: como o INSS avalia e o que conta como deficiência', 'BPC LOAS deficiência', 'BPC LOAS', 'bpc-loas', 'bpc-loas', 6),
    ('Cadastro Único para o BPC: como fazer e manter atualizado', 'cadastro único BPC', 'BPC LOAS', 'bpc-loas', 'bpc-loas', 5),
    -- Aposentadoria por invalidez (2)
    ('Aposentadoria por invalidez: quem tem direito e qual a diferença para o auxílio-doença', 'aposentadoria por invalidez quem tem direito', 'Benefícios INSS', 'beneficios-inss', 'aposentadoria-por-invalidez', 6),
    ('Adicional de 25% na aposentadoria por invalidez: quem precisa de cuidador tem direito', 'adicional 25% aposentadoria por invalidez', 'Benefícios INSS', 'beneficios-inss', 'aposentadoria-por-invalidez', 5),
    -- Pensão por morte (2)
    ('Pensão por morte para união estável sem casamento: como comprovar', 'pensão por morte união estável', 'Benefícios INSS', 'beneficios-inss', 'pensao-por-morte', 6),
    ('Pensão por morte: quanto tempo dura e quando o benefício é vitalício', 'pensão por morte quanto tempo dura', 'Benefícios INSS', 'beneficios-inss', 'pensao-por-morte', 5),
    -- Aposentadoria PCD (1)
    ('Aposentadoria PCD: tabela de tempo de contribuição por grau de deficiência (LC 142/2013)', 'aposentadoria PCD tempo de contribuição', 'Aposentadoria Especial', 'aposentadoria-especial', 'aposentadoria-pcd', 6),
    -- Indenização cível/trabalhista (1)
    ('Indenização por acidente de trânsito: o que dá para pedir além do seguro', 'indenização acidente de trânsito', 'Benefícios INSS', 'beneficios-inss', 'indenizacao-civel-trabalhista', 6)
) as seed(topic, target_keyword, category, category_slug, product_slug, priority)
where not exists (select 1 from aquisicao.blog_topics limit 1);
