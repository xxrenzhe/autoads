(() => {
  const $ = (s) => document.querySelector(s);
  const tokenKey = 'autoads_admin_id_token';
  const tokenInput = $('#tokenInput');
  const saveTokenBtn = $('#saveTokenBtn');
  const loadUsersBtn = $('#loadUsersBtn');
  const usersWrap = $('#usersWrap');
  const q = $('#q');
  const role = $('#role');
  const limit = $('#limit');
  const uidTokens = $('#uidTokens');
  const amountTokens = $('#amountTokens');
  const addTokensBtn = $('#addTokensBtn');
  const tokensResult = $('#tokensResult');
  const envBadge = $('#envBadge');
  const unreadCountEl = document.getElementById('unreadCount');
  const notifWrap = document.getElementById('notifWrap');
  const refreshNotificationsBtn = document.getElementById('refreshNotificationsBtn');
  const markAllReadBtn = document.getElementById('markAllReadBtn');
  const loadBillingCfgBtn = document.getElementById('loadBillingCfgBtn');
  const billingCfg = document.getElementById('billingCfg');
  // Keyword expansion controls
  const kwSeedDomain = document.getElementById('kwSeedDomain');
  const kwSeedKeywords = document.getElementById('kwSeedKeywords');
  const kwCountry = document.getElementById('kwCountry');
  const kwLimit = document.getElementById('kwLimit');
  const kwMinScore = document.getElementById('kwMinScore');
  const kwExpandBtn = document.getElementById('kwExpandBtn');
  const kwResult = document.getElementById('kwResult');
  // Similarity controls
  const simSeedDomain = document.getElementById('simSeedDomain');
  const simCountry = document.getElementById('simCountry');
  const simCandidates = document.getElementById('simCandidates');
  const simComputeBtn = document.getElementById('simComputeBtn');
  const simResult = document.getElementById('simResult');
  // Combo discovery controls
  const comboSeedDomain = document.getElementById('comboSeedDomain');
  const comboCountry = document.getElementById('comboCountry');
  const comboSeedKeywords = document.getElementById('comboSeedKeywords');
  const comboCandidates = document.getElementById('comboCandidates');
  const comboRunBtn = document.getElementById('comboRunBtn');
  const comboResult = document.getElementById('comboResult');
  const comboExportCsvBtn = document.getElementById('comboExportCsvBtn');
  const comboExportJsonBtn = document.getElementById('comboExportJsonBtn');
  const comboSaveBtn = document.getElementById('comboSaveBtn');
  let lastCombo = { kw: null, sim: null };

  // Init
  const saved = localStorage.getItem(tokenKey) || '';
  tokenInput.value = saved;
  envBadge.textContent = location.host.includes('-preview') ? 'preview' : (location.host.includes('dev') ? 'dev' : 'prod');

  saveTokenBtn.onclick = () => {
    localStorage.setItem(tokenKey, tokenInput.value.trim());
    alert('已保存 Token 到本地，仅用于管理页调用');
    tryReconnectSSE();
  };

  function authHeaders() {
    const t = (localStorage.getItem(tokenKey) || '').trim();
    const h = { 'Content-Type': 'application/json' };
    if (t) h['Authorization'] = 'Bearer ' + t;
    return h;
  }

  async function apiGet(path) {
    const resp = await fetch(path, { headers: authHeaders() });
    if (!resp.ok) {
      const text = await resp.text().catch(()=>'');
      throw new Error(`GET ${path} ${resp.status}: ${text}`);
    }
    return resp.json();
  }
  async function apiPost(path, body) {
    const resp = await fetch(path, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body||{}) });
    if (!resp.ok) {
      const text = await resp.text().catch(()=>'');
      throw new Error(`POST ${path} ${resp.status}: ${text}`);
    }
    return resp.json();
  }

  function renderUsers(data) {
    const items = data.items || [];
    if (!items.length) { usersWrap.innerHTML = '<div class="muted">暂无数据</div>'; return; }
    const rows = items.map(u => `<tr>
      <td>${u.id}</td><td>${u.email||''}</td><td>${u.name||''}</td><td>${u.role||''}</td><td>${new Date(u.createdAt).toLocaleString()}</td>
      <td>
        <button data-act="tokens" data-id="${u.id}">查看Tokens</button>
        <button data-act="subs" data-id="${u.id}">订阅</button>
        <button data-act="role-admin" data-id="${u.id}">设为ADMIN</button>
        <button data-act="role-user" data-id="${u.id}">设为USER</button>
      </td>
    </tr>`).join('');
    usersWrap.innerHTML = `<table><thead><tr><th>ID</th><th>Email</th><th>Name</th><th>Role</th><th>Created</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table>`;
    usersWrap.querySelectorAll('button[data-act]')
      .forEach(btn => btn.addEventListener('click', async (e) => {
        const id = btn.getAttribute('data-id');
        const act = btn.getAttribute('data-act');
        try {
          if (act === 'tokens') {
            const j = await apiGet(`/api/v1/console/users/${id}/tokens`);
            alert(`用户 ${id}\n余额: ${j.balance}\n最近交易: ${j.items?.length||0}`);
            uidTokens.value = id;
          } else if (act === 'subs') {
            const j = await apiGet(`/api/v1/console/users/${id}/subscription`);
            alert(`用户 ${id}\n套餐: ${j.planName}\n状态: ${j.status}\n到期: ${new Date(j.currentPeriodEnd).toLocaleString()}`);
          } else if (act === 'role-admin' || act === 'role-user') {
            const role = act === 'role-admin' ? 'ADMIN' : 'USER';
            if (!confirm(`确认将用户 ${id} 角色改为 ${role} ？`)) return;
            const resp = await fetch(`/api/v1/console/users/${id}/role`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ role }) });
            if (!resp.ok) throw new Error(`PUT role ${resp.status}`);
            alert('角色已更新');
            loadUsersBtn.click();
          }
        } catch (err) {
          alert(err.message);
        }
      }));
  }

  loadUsersBtn.onclick = async () => {
    try {
      const params = new URLSearchParams();
      if (q.value.trim()) params.set('q', q.value.trim());
      if (role.value.trim()) params.set('role', role.value.trim());
      const n = parseInt(limit.value, 10); if (n>0) params.set('limit', String(n));
      const data = await apiGet(`/api/v1/console/users?${params.toString()}`);
      renderUsers(data);
    } catch (err) {
      usersWrap.innerHTML = `<div class="muted">${err.message}</div>`;
    }
  };

  addTokensBtn.onclick = async () => {
    const id = uidTokens.value.trim();
    const amt = parseInt(amountTokens.value, 10);
    if (!id || !(amt>0)) { alert('请输入用户ID与数量(>0)'); return; }
    try {
      const j = await apiPost(`/api/v1/console/users/${id}/tokens`, { amount: amt });
      tokensResult.textContent = JSON.stringify(j);
      alert('变更成功');
    } catch (err) {
      alert(err.message);
    }
  };

  // Notifications list
  async function loadRecentNotifications() {
    try {
      const j = await apiGet('/api/v1/notifications/recent?limit=20');
      const items = j.items || j || [];
      if (!items.length) { notifWrap.innerHTML = '<div class="muted">无通知</div>'; return; }
      const rows = items.map(n => `<div>
        <strong>[${n.severity||'info'}]</strong> ${n.summary||n.title||''}
        <span class="muted">(${new Date(n.createdAt||n.time||Date.now()).toLocaleString()})</span>
      </div>`).join('');
      notifWrap.innerHTML = rows;
      notifWrap.setAttribute('data-latest-id', String(items[0]?.id || items[items.length-1]?.id || ''));
    } catch (e) { notifWrap.innerHTML = `<div class="muted">${e.message}</div>`; }
  }
  refreshNotificationsBtn.onclick = loadRecentNotifications;
  markAllReadBtn.onclick = async () => {
    const lastId = notifWrap.getAttribute('data-latest-id') || '';
    if (!lastId) { alert('当前列表无可标记的通知'); return; }
    try {
      await apiPost('/api/v1/notifications/read', { lastId });
      await pollUnreadOnce();
      alert('已标记为已读');
    } catch (e) { alert(e.message); }
  };

  async function pollUnreadOnce() {
    try {
      const j = await apiGet('/api/v1/notifications/unread-count');
      const c = (j && (j.count ?? j.unread ?? 0)) || 0;
      unreadCountEl.textContent = String(c);
      setUnreadBadge(c);
    } catch (e) {
      // ignore
    }
  }
  function setUnreadBadge(n) {
    const env = envBadge.textContent.replace(/\s*•.*$/, '');
    envBadge.textContent = `${env} • 未读 ${n}`;
  }

  // SSE via fetch streaming (Authorization header supported)
  let sseAbort = null;
  async function connectSSE() {
    try {
      if (sseAbort) { sseAbort.abort(); }
      const ac = new AbortController(); sseAbort = ac;
      const resp = await fetch('/api/v1/notifications/stream', { headers: authHeaders(), signal: ac.signal });
      if (!resp.ok || !resp.body) { throw new Error('SSE连接失败'); }
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const evt = buf.slice(0, idx); buf = buf.slice(idx + 2);
          const lines = evt.split('\n');
          let type = 'message', data = '';
          for (const ln of lines) {
            if (ln.startsWith('event:')) type = ln.slice(6).trim();
            else if (ln.startsWith('data:')) data += ln.slice(5).trim();
          }
          if (type === 'unread') {
            try { const j = JSON.parse(data||'{}'); const c = j.count||0; unreadCountEl.textContent = String(c); setUnreadBadge(c); } catch {}
          }
        }
      }
    } catch (e) {
      // fallback to polling
      await pollUnreadOnce();
      setTimeout(connectSSE, 5000);
    }
  }
  function tryReconnectSSE() { setTimeout(connectSSE, 300); }

  // Billing config
  loadBillingCfgBtn.onclick = async () => {
    billingCfg.textContent = '加载中...';
    try { const j = await apiGet('/api/v1/billing/config'); billingCfg.textContent = JSON.stringify(j, null, 2); }
    catch (e) { billingCfg.textContent = e.message; }
  };

  // initial
  pollUnreadOnce();
  loadRecentNotifications();
  tryReconnectSSE();

  // Token 汇总
  const tokenStatsBtn = document.getElementById('tokenStatsBtn');
  const tokenStats = document.getElementById('tokenStats');
  tokenStatsBtn.onclick = async () => {
    try {
      const j = await apiGet('/api/v1/console/tokens/stats');
      tokenStats.textContent = `用户数: ${j.users}, Token总量: ${j.totalTokens}`;
    } catch (err) {
      tokenStats.textContent = err.message;
    }
  };

  // Keyword expansion (rule-based)
  if (kwExpandBtn) {
    kwExpandBtn.onclick = async () => {
      kwResult.textContent = '生成中...';
      try {
        const seeds = (kwSeedKeywords.value||'').split(',').map(s=>s.trim()).filter(Boolean);
        const body = {
          seedDomain: kwSeedDomain.value.trim(),
          seedKeywords: seeds,
          country: kwCountry.value.trim(),
          limit: parseInt(kwLimit.value||'10', 10) || 10,
          minScore: parseFloat(kwMinScore.value||'0') || 0
        };
        const j = await apiPost('/api/v1/adscenter/keywords/expand', body);
        const items = j.items || [];
        if (!items.length) { kwResult.textContent = '无结果'; return; }
        kwResult.innerHTML = '<ol>' + items.map(it=>`<li>${it.keyword} <span class="muted">(${(it.score||0).toFixed(1)}${it.reason?(' - '+it.reason):''})</span></li>`).join('') + '</ol>';
      } catch (e) { kwResult.textContent = e.message; }
    };
  }

  // Similarity compute
  if (simComputeBtn) {
    simComputeBtn.onclick = async () => {
      simResult.textContent = '计算中...';
      try {
        const seed = (simSeedDomain.value||'').trim();
        const country = (simCountry.value||'').trim();
        const cands = (simCandidates.value||'').split(/\n|,/).map(s=>s.trim()).filter(Boolean);
        if (!seed || !cands.length) { simResult.textContent = '请填写种子域名与至少一个候选域名'; return; }
        const body = { seedDomain: seed, candidates: cands };
        if (country) body.country = country;
        const j = await apiPost('/api/v1/siterank/similar', body);
        const items = (j.items || j || []);
        if (!items.length) { simResult.textContent = '无结果'; return; }
        simResult.innerHTML = '<table><thead><tr><th>Domain</th><th>Score</th><th>Factors</th></tr></thead><tbody>' +
          items.map(it => `<tr><td>${it.domain}</td><td>${(it.score||0).toFixed(1)}</td><td><pre class="muted" style="white-space:pre-wrap">${it.factors?JSON.stringify(it.factors):''}</pre></td></tr>`).join('') +
          '</tbody></table>';
      } catch (e) { simResult.textContent = e.message; }
    };
  }

  // Combo discovery: run keyword expand + similarity and render a simple report
  if (comboRunBtn) {
    comboRunBtn.onclick = async () => {
      comboResult.textContent = '生成中...';
      try {
        const seed = (comboSeedDomain.value||'').trim();
        const country = (comboCountry.value||'').trim();
        const seeds = (comboSeedKeywords.value||'').split(',').map(s=>s.trim()).filter(Boolean);
        const cands = (comboCandidates.value||'').split(/\n|,/).map(s=>s.trim()).filter(Boolean);
        if (!seed) { comboResult.textContent = '请填写种子域名'; return; }
        // 1) keyword expand
        const bodyKW = { seedDomain: seed, seedKeywords: seeds, country, limit: 20 };
        const kw = await apiPost('/api/v1/adscenter/keywords/expand', bodyKW);
        // 2) similarity (optional if cands present)
        let sim = { items: [] };
        if (cands.length) {
          const bodySim = { seedDomain: seed, candidates: cands };
          if (country) bodySim.country = country;
          sim = await apiPost('/api/v1/siterank/similar', bodySim);
        }
        lastCombo = { kw, sim };
        const kwList = (kw.items||[]).slice(0,10).map(it=>`<li>${it.keyword} <span class="muted">(${(it.score||0).toFixed(1)})</span></li>`).join('');
        const simList = (sim.items||[]).slice(0,10).map(it=>`<tr><td>${it.domain}</td><td>${(it.score||0).toFixed(1)}</td></tr>`).join('');
        comboResult.innerHTML = `
          <div class="row"><strong>关键词建议（Top 10）</strong></div>
          <ol>${kwList||'<li class="muted">无</li>'}</ol>
          <div class="row" style="margin-top:8px"><strong>相似域名（Top 10）</strong></div>
          <table><thead><tr><th>Domain</th><th>Score</th></tr></thead><tbody>${simList||'<tr><td colspan=2 class="muted">无</td></tr>'}</tbody></table>
        `;
      } catch (e) {
        comboResult.textContent = e.message;
      }
    };
  }

  // Combo export helpers
  function downloadFile(name, mime, content) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 0);
  }
  if (comboExportJsonBtn) {
    comboExportJsonBtn.onclick = () => {
      const obj = { keywords: lastCombo.kw?.items||[], similar: lastCombo.sim?.items||[] };
      downloadFile('discovery.json', 'application/json', JSON.stringify(obj, null, 2));
    };
  }
  if (comboExportCsvBtn) {
    comboExportCsvBtn.onclick = () => {
      const kw = lastCombo.kw?.items||[]; const sim = lastCombo.sim?.items||[];
      let csv = 'type,value,score\n';
      kw.forEach(it=>{ csv += `keyword,${JSON.stringify(it.keyword)},${it.score||0}\n`; });
      sim.forEach(it=>{ csv += `domain,${JSON.stringify(it.domain)},${it.score||0}\n`; });
      downloadFile('discovery.csv', 'text/csv', csv);
    };
  }

  if (comboSaveBtn) {
    comboSaveBtn.onclick = async () => {
      if (!lastCombo.kw && !lastCombo.sim) { alert('请先生成组合报告'); return; }
      try {
        const seed = (comboSeedDomain.value||'').trim();
        const country = (comboCountry.value||'').trim();
        const seeds = (comboSeedKeywords.value||'').split(',').map(s=>s.trim()).filter(Boolean);
        const topKeywords = (lastCombo.kw?.items||[]).map(it=>({ keyword: it.keyword, score: it.score||0, reason: it.reason||'' }));
        const topDomains = (lastCombo.sim?.items||[]).map(it=>({ domain: it.domain, score: it.score||0 }));
        const body = { seedDomain: seed, country, seedKeywords: seeds, topKeywords, topDomains };
        const resp = await apiPost('/api/v1/recommend/opportunities', body);
        alert('保存成功，ID=' + (resp.id||''));
      } catch (e) { alert(e.message); }
    };
  }

  // Notification rules management
  const nrLoadBtn = document.getElementById('nrLoadBtn');
  const nrList = document.getElementById('nrList');
  const nrEventType = document.getElementById('nrEventType');
  const nrChannel = document.getElementById('nrChannel');
  const nrEnabled = document.getElementById('nrEnabled');
  const nrUpsertBtn = document.getElementById('nrUpsertBtn');
  const nrMsg = document.getElementById('nrMsg');
  // System overview controls
  const sysCheckBtn = document.getElementById('sysCheckBtn');
  const sysStatus = document.getElementById('sysStatus');
  // Opportunities controls
  const oppsLoadBtn = document.getElementById('oppsLoadBtn');
  const oppsList = document.getElementById('oppsList');
  const oppsDetail = document.getElementById('oppsDetail');
  async function nrLoad() {
    if (!nrList) return;
    nrMsg.textContent = '加载中...';
    try {
      const j = await apiGet('/api/v1/notifications/rules');
      const items = j.items || j || [];
      if (!items.length) { nrList.textContent = '无规则'; nrMsg.textContent = ''; return; }
      nrList.innerHTML = '<table><thead><tr><th>Event</th><th>Channel</th><th>Enabled</th><th>Created</th><th>Updated</th></tr></thead><tbody>' +
        items.map(r=>`<tr><td>${r.event_type||r.eventType||''}</td><td>${r.channel||''}</td><td>${r.enabled?'✅':'❌'}</td><td>${r.created_at||''}</td><td>${r.updated_at||''}</td></tr>`).join('') + '</tbody></table>';
      nrMsg.textContent = '';
    } catch (e) { nrMsg.textContent = e.message; }
  }
  if (nrLoadBtn) nrLoadBtn.onclick = nrLoad;
  if (nrUpsertBtn) nrUpsertBtn.onclick = async () => {
    nrMsg.textContent = '保存中...';
    try {
      const body = { eventType: (nrEventType.value||'').trim(), channel: (nrChannel.value||'').trim(), enabled: !!nrEnabled.checked };
      if (!body.eventType || !body.channel) { nrMsg.textContent = '请填写事件类型和渠道'; return; }
      await apiPost('/api/v1/notifications/rules', body);
      nrMsg.textContent = '保存成功';
      await nrLoad();
    } catch (e) { nrMsg.textContent = e.message; }
  };

  // System health check
  if (sysCheckBtn) {
    sysCheckBtn.onclick = async () => {
      sysStatus.textContent = '检查中...';
      const lines = [];
      async function ping(name, path, auth=false) {
        try {
          const opt = auth? { headers: authHeaders() } : {};
          const resp = await fetch(path, opt);
          lines.push(`${name}: ${resp.status}`);
        } catch (e) {
          lines.push(`${name}: ERROR ${e.message}`);
        }
      }
      await ping('Gateway /readyz', '/readyz');
      await ping('Adscenter health', '/api/health/adscenter');
      await ping('Console health', '/api/health/console');
      // Authenticated checks (optional)
      await ping('Billing config (auth)', '/api/v1/billing/config', true);
      sysStatus.innerHTML = '<pre style="white-space:pre-wrap">'+lines.join('\n')+'</pre>';
    };
  }

  // Opportunities list & detail
  async function oppsLoad() {
    if (!oppsList) return;
    oppsList.textContent = '加载中...';
    try {
      const j = await apiGet('/api/v1/recommend/opportunities');
      const items = j.items || j || [];
      if (!items.length) { oppsList.textContent = '暂无机会'; if (oppsDetail) oppsDetail.textContent = ''; return; }
      oppsList.innerHTML = '<table><thead><tr><th>ID</th><th>Seed</th><th>Country</th><th>Created</th><th>Actions</th></tr></thead><tbody>'+
        items.map(it=>`<tr><td>${it.id}</td><td>${it.seedDomain||''}</td><td>${it.country||''}</td><td>${it.createdAt?new Date(it.createdAt).toLocaleString():''}</td><td><button data-opp-id="${it.id}">查看</button></td></tr>`).join('')+
        '</tbody></table>';
      oppsList.querySelectorAll('button[data-opp-id]').forEach(btn=>{
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-opp-id');
          try { const d = await apiGet(`/api/v1/recommend/opportunities/${id}`); if (oppsDetail) oppsDetail.textContent = JSON.stringify(d, null, 2); }
          catch (e) { if (oppsDetail) oppsDetail.textContent = e.message; }
        });
      });
    } catch (e) { oppsList.textContent = e.message; if (oppsDetail) oppsDetail.textContent=''; }
  }
  if (oppsLoadBtn) oppsLoadBtn.onclick = oppsLoad;
})();
