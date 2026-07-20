// ============================================================================
// Blog Admin — Almeida & Matos (SPA vanilla, sem framework)
// Autentica com senha (sessionStorage) e fala com /api/admin/* via fetch.
// ============================================================================

(() => {
    'use strict';

    const API = '/api';
    const STORAGE_KEY = 'am_blog_admin_pw';
    const WEEKDAYS_PT = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

    // Estado da aplicação
    const state = {
        posts: [],
        topics: [],
        settings: null,
        editingPostId: null,
        postsFilter: { status: '', q: '' },
        topicsFilter: 'pending',
        logsFilter: '',
    };

    const $ = (sel) => document.querySelector(sel);

    function esc(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // ------------------------------------------------------------------ Toasts
    function toast(message, type = 'info') {
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.textContent = message;
        $('#toast-container').appendChild(el);
        setTimeout(() => el.remove(), 4500);
    }

    // ------------------------------------------------------- Botão c/ loading
    function setBtnLoading(btn, loading) {
        if (!btn) return;
        btn.disabled = loading;
        const label = btn.querySelector('.btn-label');
        if (loading) {
            btn.dataset.originalHtml = label ? label.textContent : btn.textContent;
            if (label) label.innerHTML = '<span class="spinner"></span>';
            else btn.innerHTML = '<span class="spinner"></span>';
        } else if (btn.dataset.originalHtml) {
            if (label) label.textContent = btn.dataset.originalHtml;
            else btn.textContent = btn.dataset.originalHtml;
        }
    }

    // ------------------------------------------------------------- API client
    async function api(path, { method = 'GET', body } = {}) {
        const res = await fetch(`${API}${path}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'x-admin-password': encodeURIComponent(sessionStorage.getItem(STORAGE_KEY) || ''),
            },
            body: body ? JSON.stringify(body) : undefined,
        });

        if (res.status === 401) {
            logout();
            throw new Error('Sessão expirada — faça login de novo');
        }

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
        return data;
    }

    // ------------------------------------------------------------------ Auth
    function showApp() {
        $('#login-screen').classList.add('hidden');
        $('#app').classList.remove('hidden');
        loadDashboard();
        loadSettings();
    }

    function logout() {
        sessionStorage.removeItem(STORAGE_KEY);
        $('#app').classList.add('hidden');
        $('#login-screen').classList.remove('hidden');
        $('#login-password').value = '';
    }

    async function handleLogin(e) {
        e.preventDefault();
        const btn = $('#login-btn');
        const errEl = $('#login-error');
        errEl.classList.add('hidden');
        setBtnLoading(btn, true);
        try {
            const password = $('#login-password').value;
            const res = await fetch(`${API}/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });
            if (!res.ok) throw new Error('Senha incorreta');
            sessionStorage.setItem(STORAGE_KEY, password);
            showApp();
        } catch (err) {
            errEl.textContent = err.message;
            errEl.classList.remove('hidden');
        } finally {
            setBtnLoading(btn, false);
        }
    }

    // ------------------------------------------------------------------ Tabs
    function switchTab(name) {
        document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
        document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('hidden', p.id !== `tab-${name}`));
        if (name === 'topics') loadTopics();
        if (name === 'logs') loadLogs();
        if (name === 'settings') loadSettings(true);
        if (name === 'dashboard') loadDashboard();
    }

    // ------------------------------------------------------------- Dashboard
    async function loadDashboard() {
        const tbody = $('#posts-tbody');
        $('#posts-loading').classList.remove('hidden');
        $('#posts-empty').classList.add('hidden');
        tbody.innerHTML = '';
        try {
            const params = new URLSearchParams({ limit: '100' });
            if (state.postsFilter.status) params.set('status', state.postsFilter.status);
            if (state.postsFilter.q) params.set('q', state.postsFilter.q);

            const [posts, topics] = await Promise.all([
                api(`/admin/posts?${params}`),
                api('/admin/topics?status=pending'),
            ]);
            state.posts = posts;

            // Stats (contagens sobre o retorno sem filtro de status seria melhor,
            // mas 100 itens cobre o uso atual; refina quando o acervo crescer)
            const all = state.postsFilter.status || state.postsFilter.q
                ? await api('/admin/posts?limit=200')
                : posts;
            $('#stat-published').textContent = all.filter((p) => p.status === 'published').length;
            $('#stat-drafts').textContent = all.filter((p) => p.status === 'draft').length;
            $('#stat-topics').textContent = topics.length;
            $('#stat-next').textContent = computeNextPublication();

            renderPostsTable(posts);
        } catch (err) {
            toast(err.message, 'error');
        } finally {
            $('#posts-loading').classList.add('hidden');
        }
    }

    /** Próxima publicação com base nas settings (dias + hora, fuso do navegador ~BRT). */
    function computeNextPublication() {
        const s = state.settings;
        if (!s) return '—';
        if (!s.enabled) return 'Desativado';
        const days = Array.isArray(s.publish_days) && s.publish_days.length ? s.publish_days : [1, 3, 5];
        const hour = Number.isInteger(s.publish_hour) ? s.publish_hour : 7;
        const now = new Date();
        for (let i = 0; i < 8; i++) {
            const d = new Date(now);
            d.setDate(now.getDate() + i);
            if (!days.includes(d.getDay())) continue;
            if (i === 0 && now.getHours() >= hour) continue; // hoje já passou da hora
            const label = i === 0 ? 'hoje' : i === 1 ? 'amanhã' : WEEKDAYS_PT[d.getDay()];
            return `${label} ${String(hour).padStart(2, '0')}h`;
        }
        return '—';
    }

    function formatDateBR(iso) {
        if (!iso) return '—';
        const d = new Date(iso);
        return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    }

    const STATUS_LABEL = { published: 'Publicado', draft: 'Rascunho', scheduled: 'Agendado', archived: 'Arquivado' };

    function renderPostsTable(posts) {
        const tbody = $('#posts-tbody');
        if (!posts.length) {
            $('#posts-empty').classList.remove('hidden');
            tbody.innerHTML = '';
            return;
        }
        $('#posts-empty').classList.add('hidden');

        tbody.innerHTML = posts.map((p) => `
            <tr data-id="${esc(p.id)}">
                <td>
                    <span class="post-title-cell">${p.status === 'published'
                        ? `<a href="/${esc(p.slug)}/" target="_blank" rel="noopener">${esc(p.title)}</a>`
                        : esc(p.title)}</span>
                    <span class="post-slug-cell">/${esc(p.slug)}/ ${p.origin === 'ai' ? '· <span class="badge badge-ai">IA</span>' : ''}</span>
                </td>
                <td><span class="badge badge-${esc(p.status)}">${STATUS_LABEL[p.status] || esc(p.status)}</span></td>
                <td>${esc(p.category || '—')}</td>
                <td>${formatDateBR(p.published_at || p.created_at)}</td>
                <td>
                    <div class="row-actions">
                        ${p.status !== 'archived' ? `<button class="btn btn-outline btn-sm" data-action="toggle">${p.status === 'published' ? 'Despublicar' : 'Publicar'}</button>` : ''}
                        <button class="btn btn-outline btn-sm" data-action="edit">Editar</button>
                        ${p.status !== 'archived' ? '<button class="btn btn-danger btn-sm" data-action="archive">Arquivar</button>' : ''}
                    </div>
                </td>
            </tr>
        `).join('');
    }

    async function handlePostAction(e) {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const tr = btn.closest('tr');
        const id = tr?.dataset.id;
        const post = state.posts.find((p) => p.id === id);
        if (!post) return;

        const action = btn.dataset.action;
        try {
            if (action === 'toggle') {
                setBtnLoading(btn, true);
                const newStatus = post.status === 'published' ? 'draft' : 'published';
                await api(`/admin/posts?id=${id}`, { method: 'PATCH', body: { status: newStatus } });
                toast(newStatus === 'published' ? 'Post publicado' : 'Post despublicado', 'success');
                loadDashboard();
            } else if (action === 'archive') {
                if (!confirm(`Arquivar "${post.title}"? Ele sai do site mas fica no banco.`)) return;
                setBtnLoading(btn, true);
                await api(`/admin/posts?id=${id}`, { method: 'DELETE' });
                toast('Post arquivado', 'success');
                loadDashboard();
            } else if (action === 'edit') {
                openPostModal(post);
            }
        } catch (err) {
            toast(err.message, 'error');
            setBtnLoading(btn, false);
        }
    }

    // --------------------------------------------------------- Modal de post
    function faqItemHtml(faq = { question: '', answer: '' }) {
        return `
            <div class="faq-editor-item">
                <button type="button" class="btn btn-danger btn-sm faq-remove">Remover</button>
                <input type="text" class="faq-q" placeholder="Pergunta" value="${esc(faq.question)}">
                <textarea class="faq-a" placeholder="Resposta">${esc(faq.answer)}</textarea>
            </div>`;
    }

    async function openPostModal(postSummary) {
        state.editingPostId = postSummary ? postSummary.id : null;
        $('#post-modal-title').textContent = postSummary ? 'Editar post' : 'Novo post manual';

        let post = postSummary || {};
        if (postSummary) {
            // A listagem não traz content_html/faq — busca o registro completo por id
            post = (await fetchFullPost(postSummary.id)) || postSummary;
        }

        $('#pm-title').value = post.title || '';
        $('#pm-slug').value = post.slug || '';
        $('#pm-status').value = post.status || 'draft';
        $('#pm-excerpt').value = post.excerpt || '';
        $('#pm-meta-title').value = post.meta_title || '';
        $('#pm-meta-description').value = post.meta_description || '';
        $('#pm-content').value = post.content_html || '';

        const faqList = $('#pm-faq-list');
        const faqs = Array.isArray(post.faq) ? post.faq : [];
        faqList.innerHTML = faqs.map(faqItemHtml).join('');

        $('#post-modal').classList.remove('hidden');
    }

    /** Busca o post completo (com content_html e faq) direto pelo id. */
    async function fetchFullPost(id) {
        try {
            return await api(`/admin/posts?id=${encodeURIComponent(id)}`);
        } catch {
            return null;
        }
    }

    function closePostModal() {
        $('#post-modal').classList.add('hidden');
        state.editingPostId = null;
    }

    function collectFaq() {
        return [...document.querySelectorAll('#pm-faq-list .faq-editor-item')]
            .map((item) => ({
                question: item.querySelector('.faq-q').value.trim(),
                answer: item.querySelector('.faq-a').value.trim(),
            }))
            .filter((f) => f.question && f.answer);
    }

    async function handlePostSave(e) {
        e.preventDefault();
        const btn = $('#pm-save');
        setBtnLoading(btn, true);
        try {
            const payload = {
                title: $('#pm-title').value.trim(),
                slug: $('#pm-slug').value.trim(),
                status: $('#pm-status').value,
                excerpt: $('#pm-excerpt').value.trim(),
                meta_title: $('#pm-meta-title').value.trim(),
                meta_description: $('#pm-meta-description').value.trim(),
                content_html: $('#pm-content').value,
                faq: collectFaq(),
            };
            if (!payload.slug) delete payload.slug;

            if (state.editingPostId) {
                await api(`/admin/posts?id=${state.editingPostId}`, { method: 'PATCH', body: payload });
                toast('Post salvo', 'success');
            } else {
                await api('/admin/posts', { method: 'POST', body: payload });
                toast('Post criado', 'success');
            }
            closePostModal();
            loadDashboard();
        } catch (err) {
            toast(err.message, 'error');
        } finally {
            setBtnLoading(btn, false);
        }
    }

    // ------------------------------------------------------------ Gerar post
    async function openGenerateModal() {
        try {
            const topics = await api('/admin/topics?status=pending');
            const select = $('#gen-topic-select');
            select.innerHTML = '<option value="">Automática (maior prioridade)</option>' +
                topics.map((t) => `<option value="${esc(t.id)}">[${t.priority}] ${esc(t.topic)}</option>`).join('');
            $('#gen-topic-free').value = '';
            $('#generate-modal').classList.remove('hidden');
        } catch (err) {
            toast(err.message, 'error');
        }
    }

    async function handleGenerate() {
        const btn = $('#gen-confirm');
        setBtnLoading(btn, true);
        try {
            const free = $('#gen-topic-free').value.trim();
            const topicId = $('#gen-topic-select').value;
            const body = free ? { topic: free } : (topicId ? { topic_id: topicId } : {});

            toast('Gerando post… isso leva de 30s a 2min', 'info');
            const result = await api('/admin/generate', { method: 'POST', body });

            $('#generate-modal').classList.add('hidden');
            const p = result.post;
            toast(`Post gerado: "${p.title}" (${p.words} palavras, ${STATUS_LABEL[p.status] || p.status})`, 'success');
            if (result.url) window.open(result.url, '_blank', 'noopener');
            loadDashboard();
        } catch (err) {
            toast(`Falha na geração: ${err.message}`, 'error');
        } finally {
            setBtnLoading(btn, false);
        }
    }

    // ---------------------------------------------------------------- Pautas
    async function loadTopics() {
        const tbody = $('#topics-tbody');
        $('#topics-loading').classList.remove('hidden');
        $('#topics-empty').classList.add('hidden');
        tbody.innerHTML = '';
        try {
            const status = state.topicsFilter;
            const topics = await api(`/admin/topics${status ? `?status=${status}` : ''}`);
            state.topics = topics;
            renderTopicsTable(topics);
        } catch (err) {
            toast(err.message, 'error');
        } finally {
            $('#topics-loading').classList.add('hidden');
        }
    }

    const TOPIC_STATUS_LABEL = { pending: 'Pendente', used: 'Usada', discarded: 'Descartada' };

    // Origem das pautas: de onde cada uma entrou na fila
    const SOURCE_LABEL = {
        manual: 'Manual',
        contentlab: 'Content Lab',
        notion: 'Notion',
        editorial: 'Linha editorial',
        ia: 'IA',
    };

    function renderSourceBadge(source) {
        const key = String(source || 'manual');
        const label = SOURCE_LABEL[key] || key;
        return `<span class="badge badge-source badge-source-${esc(key)}">${esc(label)}</span>`;
    }

    function renderTopicsTable(topics) {
        const tbody = $('#topics-tbody');
        if (!topics.length) {
            $('#topics-empty').classList.remove('hidden');
            return;
        }
        tbody.innerHTML = topics.map((t) => `
            <tr data-id="${esc(t.id)}">
                <td>
                    ${t.status === 'pending'
                        ? `<input type="number" class="topic-priority" min="0" max="100" value="${t.priority}" style="width:64px">`
                        : esc(String(t.priority))}
                </td>
                <td>
                    <span class="post-title-cell" style="white-space:normal">${esc(t.topic)}</span>
                    ${t.target_keyword ? `<span class="post-slug-cell">kw: ${esc(t.target_keyword)}</span>` : ''}
                </td>
                <td>${renderSourceBadge(t.source)}</td>
                <td>${esc(t.product_slug || '—')}</td>
                <td><span class="badge badge-${esc(t.status)}">${TOPIC_STATUS_LABEL[t.status] || esc(t.status)}</span></td>
                <td>
                    <div class="row-actions">
                        ${t.status === 'pending' ? '<button class="btn btn-danger btn-sm" data-action="discard">Descartar</button>' : ''}
                        ${t.status === 'discarded' ? '<button class="btn btn-outline btn-sm" data-action="restore">Restaurar</button>' : ''}
                    </div>
                </td>
            </tr>
        `).join('');
    }

    async function handleTopicAction(e) {
        // Prioridade editada inline
        if (e.type === 'change' && e.target.classList.contains('topic-priority')) {
            const tr = e.target.closest('tr');
            const priority = parseInt(e.target.value, 10);
            if (!Number.isInteger(priority) || priority < 0 || priority > 100) return;
            try {
                await api(`/admin/topics?id=${tr.dataset.id}`, { method: 'PATCH', body: { priority } });
                toast('Prioridade atualizada', 'success');
            } catch (err) {
                toast(err.message, 'error');
            }
            return;
        }

        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const id = btn.closest('tr')?.dataset.id;
        try {
            if (btn.dataset.action === 'discard') {
                setBtnLoading(btn, true);
                await api(`/admin/topics?id=${id}`, { method: 'DELETE' });
                toast('Pauta descartada', 'success');
            } else if (btn.dataset.action === 'restore') {
                setBtnLoading(btn, true);
                await api(`/admin/topics?id=${id}`, { method: 'PATCH', body: { status: 'pending' } });
                toast('Pauta restaurada', 'success');
            }
            loadTopics();
        } catch (err) {
            toast(err.message, 'error');
            setBtnLoading(btn, false);
        }
    }

    async function handleTopicAdd(e) {
        e.preventDefault();
        const btn = $('#topic-add-btn');
        setBtnLoading(btn, true);
        try {
            await api('/admin/topics', {
                method: 'POST',
                body: {
                    topic: $('#topic-input').value.trim(),
                    target_keyword: $('#topic-keyword').value.trim(),
                    product_slug: $('#topic-product').value,
                    priority: parseInt($('#topic-priority').value, 10) || 5,
                },
            });
            toast('Pauta adicionada', 'success');
            $('#topic-form').reset();
            $('#topic-priority').value = '5';
            loadTopics();
        } catch (err) {
            toast(err.message, 'error');
        } finally {
            setBtnLoading(btn, false);
        }
    }

    // -------------------------------------------------------------- Histórico
    const LOG_STATUS_LABEL = { success: 'Publicou', error: 'Erro', skipped: 'Pulou' };
    const TRIGGER_LABEL = { cron: 'Automático', manual: 'Manual' };

    /** "hoje 07h01", "ontem 07h00" ou "18/07 07h00" */
    function formatRunAt(iso) {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '—';
        const hhmm = `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
        const today = new Date();
        const dayDiff = Math.round(
            (new Date(today.getFullYear(), today.getMonth(), today.getDate()) -
             new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000
        );
        if (dayDiff === 0) return `hoje ${hhmm}`;
        if (dayDiff === 1) return `ontem ${hhmm}`;
        return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${hhmm}`;
    }

    function formatDuration(ms) {
        if (!ms && ms !== 0) return '—';
        return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(0)}s`;
    }

    /** Banner de saúde: silencioso quando está tudo em dia. */
    function renderLogsHealth(health) {
        const el = $('#logs-health');
        const days = health.days_since_success;

        if (days === null) {
            el.className = 'health-banner warn';
            el.innerHTML = '<strong>Nenhuma publicação registrada ainda.</strong> Assim que o gerador rodar, o resultado aparece aqui.';
            el.classList.remove('hidden');
            return;
        }
        // Sem publicar há mais de 4 dias: passou de um ciclo seg/qua/sex inteiro
        if (days > 4) {
            el.className = 'health-banner error';
            el.innerHTML = `<strong>Atenção: ${days} dias sem publicar.</strong> ` +
                (health.last_error_detail
                    ? `Último erro: ${esc(String(health.last_error_detail).slice(0, 200))}`
                    : 'O agendamento pode ter parado de rodar.');
            el.classList.remove('hidden');
            return;
        }
        el.className = 'health-banner ok';
        el.innerHTML = `Última publicação: <strong>${formatRunAt(health.last_success_at)}</strong>. Agendamento rodando normalmente.`;
        el.classList.remove('hidden');
    }

    function renderLogsTable(items) {
        const tbody = $('#logs-tbody');
        if (!items.length) {
            $('#logs-empty').classList.remove('hidden');
            tbody.innerHTML = '';
            return;
        }
        $('#logs-empty').classList.add('hidden');

        tbody.innerHTML = items.map((it) => {
            // Post publicado vira link; senão mostra o detalhe cru do log
            const detail = it.post
                ? `${it.post.status === 'published'
                    ? `<a href="/${esc(it.post.slug)}/" target="_blank" rel="noopener">${esc(it.post.title)}</a>`
                    : esc(it.post.title)}` +
                  (it.topic ? `<span class="post-slug-cell">pauta ${esc(it.topic.source || 'manual')}${it.model ? ` · ${esc(it.model)}` : ''}</span>` : '')
                : `<span class="log-detail">${esc(it.detail || '—')}</span>`;

            return `
            <tr>
                <td>${esc(formatRunAt(it.run_at))}</td>
                <td>${esc(TRIGGER_LABEL[it.trigger_source] || it.trigger_source || '—')}</td>
                <td><span class="badge badge-log-${esc(it.status)}">${LOG_STATUS_LABEL[it.status] || esc(it.status)}</span></td>
                <td>${detail}</td>
                <td style="text-align:right">${esc(formatDuration(it.duration_ms))}</td>
            </tr>`;
        }).join('');
    }

    async function loadLogs() {
        $('#logs-loading').classList.remove('hidden');
        $('#logs-empty').classList.add('hidden');
        try {
            const params = new URLSearchParams({ limit: '60' });
            if (state.logsFilter) params.set('status', state.logsFilter);
            const { items, health } = await api(`/admin/logs?${params}`);
            renderLogsHealth(health);
            renderLogsTable(items);
        } catch (err) {
            toast(err.message, 'error');
        } finally {
            $('#logs-loading').classList.add('hidden');
        }
    }

    // --------------------------------------------------------------- Settings
    async function loadSettings(force = false) {
        if (state.settings && !force) return applySettingsToForm();
        try {
            state.settings = await api('/admin/settings');
            applySettingsToForm();
            $('#stat-next').textContent = computeNextPublication();
        } catch (err) {
            toast(err.message, 'error');
        }
    }

    function applySettingsToForm() {
        const s = state.settings;
        if (!s) return;
        $('#set-enabled').checked = !!s.enabled;
        $('#set-auto-publish').checked = !!s.auto_publish;
        $('#set-posts-per-week').value = s.posts_per_week ?? 3;
        $('#set-model').value = s.model || 'gemini-2.5-flash';
        $('#set-editorial').value = s.editorial_line || '';
        $('#set-tone').value = s.tone || '';
        $('#set-extra').value = s.extra_instructions || '';

        const days = Array.isArray(s.publish_days) ? s.publish_days : [1, 3, 5];
        document.querySelectorAll('#set-days input').forEach((cb) => {
            cb.checked = days.includes(parseInt(cb.value, 10));
            cb.closest('.day-chip').classList.toggle('checked', cb.checked);
        });
    }

    async function handleSettingsSave(e) {
        e.preventDefault();
        const btn = $('#settings-save-btn');
        setBtnLoading(btn, true);
        try {
            const publishDays = [...document.querySelectorAll('#set-days input:checked')]
                .map((cb) => parseInt(cb.value, 10));
            if (!publishDays.length) throw new Error('Selecione ao menos 1 dia de publicação');

            state.settings = await api('/admin/settings', {
                method: 'PATCH',
                body: {
                    enabled: $('#set-enabled').checked,
                    auto_publish: $('#set-auto-publish').checked,
                    posts_per_week: parseInt($('#set-posts-per-week').value, 10) || 3,
                    publish_days: publishDays,
                    model: $('#set-model').value,
                    editorial_line: $('#set-editorial').value.trim(),
                    tone: $('#set-tone').value.trim(),
                    extra_instructions: $('#set-extra').value.trim(),
                },
            });
            toast('Configurações salvas', 'success');
            $('#stat-next').textContent = computeNextPublication();
        } catch (err) {
            toast(err.message, 'error');
        } finally {
            setBtnLoading(btn, false);
        }
    }

    // ------------------------------------------------------------ Bind events
    function bindEvents() {
        $('#login-form').addEventListener('submit', handleLogin);
        $('#btn-logout').addEventListener('click', logout);

        document.querySelectorAll('.tab').forEach((t) =>
            t.addEventListener('click', () => switchTab(t.dataset.tab)));

        // Dashboard
        $('#posts-tbody').addEventListener('click', handlePostAction);
        $('#posts-status-filter').addEventListener('change', (e) => {
            state.postsFilter.status = e.target.value;
            loadDashboard();
        });
        let searchTimer;
        $('#posts-search').addEventListener('input', (e) => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                state.postsFilter.q = e.target.value.trim();
                loadDashboard();
            }, 400);
        });
        $('#btn-new-post').addEventListener('click', () => openPostModal(null));

        // Modal de post
        $('#post-form').addEventListener('submit', handlePostSave);
        $('#pm-cancel').addEventListener('click', closePostModal);
        $('#pm-faq-add').addEventListener('click', () => {
            $('#pm-faq-list').insertAdjacentHTML('beforeend', faqItemHtml());
        });
        $('#pm-faq-list').addEventListener('click', (e) => {
            if (e.target.classList.contains('faq-remove')) e.target.closest('.faq-editor-item').remove();
        });
        $('#post-modal').addEventListener('click', (e) => {
            if (e.target === $('#post-modal')) closePostModal();
        });

        // Gerar post
        $('#btn-generate').addEventListener('click', openGenerateModal);
        $('#gen-confirm').addEventListener('click', handleGenerate);
        $('#gen-cancel').addEventListener('click', () => $('#generate-modal').classList.add('hidden'));
        $('#generate-modal').addEventListener('click', (e) => {
            if (e.target === $('#generate-modal')) $('#generate-modal').classList.add('hidden');
        });

        // Pautas
        $('#topic-form').addEventListener('submit', handleTopicAdd);
        $('#topics-tbody').addEventListener('click', handleTopicAction);
        $('#topics-tbody').addEventListener('change', handleTopicAction);
        $('#topics-status-filter').addEventListener('change', (e) => {
            state.topicsFilter = e.target.value;
            loadTopics();
        });

        // Histórico
        $('#logs-status-filter').addEventListener('change', (e) => {
            state.logsFilter = e.target.value;
            loadLogs();
        });
        $('#btn-refresh-logs').addEventListener('click', loadLogs);

        // Settings
        $('#settings-form').addEventListener('submit', handleSettingsSave);
        $('#set-days').addEventListener('change', (e) => {
            if (e.target.matches('input')) {
                e.target.closest('.day-chip').classList.toggle('checked', e.target.checked);
            }
        });
    }

    // ------------------------------------------------------------------ Init
    async function init() {
        bindEvents();
        const saved = sessionStorage.getItem(STORAGE_KEY);
        if (saved) {
            // Revalida a senha guardada — se mudou no servidor, volta pro login
            try {
                const res = await fetch(`${API}/admin/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password: saved }),
                });
                if (res.ok) return showApp();
            } catch { /* segue pro login */ }
            sessionStorage.removeItem(STORAGE_KEY);
        }
    }

    document.addEventListener('DOMContentLoaded', init);
})();
