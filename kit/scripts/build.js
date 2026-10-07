#!/usr/bin/env node
// Painéis Ongoing SMB — build determinístico.
// Lê os dados brutos já buscados (raw/), calcula tudo, gera dist/<slug>/index.html e VERIFICA.
// Se qualquer verificação falhar, sai com código 1 e nada deve ser publicado.
//
// Uso: node build.js [--now 2026-09-30T21:00:00-03:00]
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const MINIFY = !process.argv.includes('--no-min');
// Minificação (terser p/ JS, csso p/ CSS). A verificação roda DEPOIS, sobre o arquivo final.
function minJS(src) { return MINIFY ? execFileSync('terser', ['--compress', 'passes=1,keep_fnames=true,keep_fargs=true', '--comments', '/__DATA_/', '--beautify', 'beautify=false,max_line_len=160'], { input: src, maxBuffer: 1 << 26 }).toString() : src; }
function minHTMLShell(html) {
  if (!MINIFY) return html;
  return html.replace(/<style>([\s\S]*?)<\/style>/g, (m, css) => '<style>' + execFileSync('csso', [], { input: css }).toString().trim() + '</style>')
             .replace(/\n\s+/g, '\n');
}

const ROOT = path.join(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const T = (f) => fs.readFileSync(path.join(ROOT, 'templates', f), 'utf8');
const RAW = (f) => path.join(ROOT, 'raw', f);

const argNow = process.argv.indexOf('--now');
const NOW = argNow > 0 ? new Date(process.argv[argNow + 1]) : new Date();
const OFF = cfg.timezoneOffsetHours * 3600e3; // BRT = -3h (sem horário de verão desde 2019)
const DAY = 864e5;
const MES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// ---------- datas (tudo em horário de Brasília) ----------
const local = (ms) => new Date(ms + OFF);                  // "relógio" BRT lido com getUTC*
const ymd = (ms) => local(ms).toISOString().slice(0, 10);   // YYYY-MM-DD em BRT
const pad = (n) => String(n).padStart(2, '0');

function periods(now) {
  const L = local(now.getTime());
  const months = [];
  for (let k = cfg.meses - 1; k >= 0; k--) {
    const d = new Date(Date.UTC(L.getUTCFullYear(), L.getUTCMonth() - k, 1));
    const key = d.toISOString().slice(0, 7);
    const last = k === 0;
    months.push({ key, label: MES[d.getUTCMonth()] + '/' + String(d.getUTCFullYear()).slice(2) + (last ? '*' : '') });
  }
  // semanas fechadas seg–dom: S-1 = semana passada
  const dow = (L.getUTCDay() + 6) % 7; // 0 = segunda
  const thisMon = Date.UTC(L.getUTCFullYear(), L.getUTCMonth(), L.getUTCDate() - dow);
  const weeks = [];
  for (let k = cfg.semanas; k >= 1; k--) {
    const s = new Date(thisMon - 7 * k * DAY), e = new Date(thisMon - (7 * k - 6) * DAY);
    weeks.push({ key: s.toISOString().slice(0, 10), start: s.toISOString().slice(0, 10), end: e.toISOString().slice(0, 10),
      label: 'S-' + k, range: pad(s.getUTCDate()) + '/' + pad(s.getUTCMonth() + 1) + '–' + pad(e.getUTCDate()) + '/' + pad(e.getUTCMonth() + 1) });
  }
  return { months, weeks };
}
const P = periods(NOW);
// Dias: os 10 últimos dias úteis até ontem (sem sábado, domingo e feriado nacional, incluindo carnaval)
const FERIADOS = new Set(['2026-01-01', '2026-02-16', '2026-02-17', '2026-04-03', '2026-04-21', '2026-05-01', '2026-06-04', '2026-09-07', '2026-10-12', '2026-11-02', '2026-11-15', '2026-11-20', '2026-12-25',
  '2027-01-01', '2027-02-08', '2027-02-09', '2027-03-26', '2027-04-21', '2027-05-01', '2027-05-27', '2027-09-07', '2027-10-12', '2027-11-02', '2027-11-15', '2027-11-20', '2027-12-25']);
P.days = (() => {
  const L = local(NOW.getTime()); const out = [];
  for (let t = Date.UTC(L.getUTCFullYear(), L.getUTCMonth(), L.getUTCDate()) - DAY; out.length < 10; t -= DAY) {
    const d = new Date(t), iso = d.toISOString().slice(0, 10), wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6 && !FERIADOS.has(iso)) out.unshift({ key: iso, label: iso.slice(8, 10) + '/' + iso.slice(5, 7) });
  }
  return out;
})();
const monthIdx = (ms) => P.months.findIndex((m) => m.key === ymd(ms).slice(0, 7));
const weekIdx = (ms) => { const d = ymd(ms); return P.weeks.findIndex((w) => d >= w.start && d <= w.end); };
const dayIdx = (ms) => { const d = ymd(ms); return P.days.findIndex((x) => x.key === d); };

// ---------- dados brutos ----------
const serv = JSON.parse(fs.readFileSync(RAW('servicos_realizado.json'), 'utf8'));
const dev = JSON.parse(fs.readFileSync(RAW('devolucao.json'), 'utf8'));
const agg = JSON.parse(fs.readFileSync(RAW('aggregates.json'), 'utf8'));

// ---------- cálculo (metodologia validada — ver README) ----------
function agendMetrics(ownerIds) {
  const set = new Set(ownerIds);
  const z = (n) => Array(n).fill(0);
  const M = P.months.length, W = P.weeks.length, DD = P.days.length;
  const r = { ticketsM: z(M), ticketsS: z(W), ticketsD: z(DD), potM: z(M), potS: z(W), potD: z(DD), realM: z(M), recM: z(M),
    _dM: P.months.map(() => []), _dS: P.weeks.map(() => []), _dD: P.days.map(() => []) };
  const add = (ms, fn) => { const i = monthIdx(ms), j = weekIdx(ms), k = dayIdx(ms); if (i >= 0) fn('M', i); if (j >= 0) fn('S', j); if (k >= 0) fn('D', k); };
  for (const t of serv) {
    if (!set.has(t.o) || !t.rea) continue;
    const dias = t.rec ? (t.rea - t.rec) / DAY : null;
    add(t.rea, (k, i) => {
      r['tickets' + k][i]++; r['pot' + k][i] += t.disp || 0;
      if (k === 'M') r.realM[i]++;                    // Realizado (SLA) = só Serviços
      if (dias != null && dias >= 0) r['_d' + k][i].push(dias);
    });
  }
  for (const t of dev) {
    if (!set.has(t.o) || !t.ent) continue;
    const dias = t.ini ? (t.ent - t.ini) / DAY : null;
    add(t.ent, (k, i) => {
      r['tickets' + k][i]++;                          // Qtd. tickets = Serviços + Devolução
      if (dias != null && dias >= 0) r['_d' + k][i].push(dias); // média ponderada Serv+Dev juntos
    });
  }
  const avg = (a) => (a.length ? Math.round(10 * a.reduce((s, v) => s + v, 0) / a.length) / 10 : null);
  r.diasM = r._dM.map(avg); r.diasS = r._dS.map(avg); r.diasD = r._dD.map(avg);
  r.recM = P.months.map((m) => ownerIds.reduce((s, o) => s + (((agg.recebido[o] || {}).m || {})[m.key] || 0), 0));
  delete r._dM; delete r._dS; delete r._dD;
  return r;
}

const agendIds = cfg.pessoas.filter((p) => p.papel === 'agendamento').map((p) => p.ownerId);
const team = agendMetrics(agendIds);

function prestData(p) {
  const A = agg.prestador[p.slug];
  const pct = (x) => (x && x[0] ? Math.round(1000 * x[1] / x[0]) / 10 : null);
  const days = Object.keys(A.vol_d).sort().filter((d) => d < ymd(NOW.getTime())).slice(-15);
  return {
    slaM: P.months.map((m) => pct(A.sla_m[m.key])),
    slaS: P.weeks.map((w) => pct(A.sla_w[w.key])),
    volM: P.months.map((m) => (A.vol_m[m.key] == null ? null : A.vol_m[m.key])),
    volD: { labels: days.map((d) => d.slice(8, 10) + '/' + d.slice(5, 7)), values: days.map((d) => A.vol_d[d]) },
    note: A.note || ''
  };
}


// ---------- Atendimento (Intercom) — opcional: só entra se raw/intercom_smb.json existir ----------
// Gerado toda segunda pelo GitHub Actions do dash-smb (scripts/intercom_reporting.mjs), pela Reporting Data Export API.
// Formato: { periodos:[{tipo:'mes'|'mtd'|'semana', key, id}], equipe:{ id:{volume,csat,n_csat,sla1,slaSub,tme,tma} },
//            agentes:{ 'Nome no Intercom': { id:{fechadas,csat,n_csat,sla1,slaSub,tme,tma} } } }  (durações em segundos)
// id = 'YYYY-MM' para meses (o atual é MTD), 'YYYY-MM-DD@S' para semanas e 'YYYY-MM-DD@D' para os 10 últimos dias úteis.
const INTERCOM = fs.existsSync(RAW('intercom_smb.json')) ? JSON.parse(((t) => (t.charCodeAt(0) === 0xfeff ? t.slice(1) : t))(fs.readFileSync(RAW('intercom_smb.json'), 'utf8'))) : null;
function intercomAgente(p) {
  if (!INTERCOM || !p.intercom) return null;
  const re = new RegExp(p.intercom, 'i');
  const nomes = Object.keys(INTERCOM.agentes || {}).filter((n) => re.test(n));
  return nomes.length === 1 ? nomes[0] : null;   // ambíguo ou ausente = sem dados (nunca chuta)
}
// Dias: os últimos dias úteis que o robô exportou (no máximo 10), sem dias zerados (fim de semana/feriado nunca entram)
const ATEND_DIAS = INTERCOM ? (INTERCOM.periodos || []).filter((x) => x.tipo === 'dia' && ((INTERCOM.equipe[x.id] || {}).volume || 0) > 0).slice(-10) : [];
function atendSeries(src, campoVolume) {        // src = INTERCOM.equipe ou INTERCOM.agentes[nome]
  const ids = { M: P.months.map((m) => m.key), S: P.weeks.map((w) => w.key + '@S'), D: ATEND_DIAS.map((d) => d.id) };
  const g = (id, c) => { const v = (src[id] || {})[c]; return v == null ? null : v; };
  const out = {};
  for (const k of ['M', 'S', 'D']) {
    out['conv' + k] = ids[k].map((id) => g(id, campoVolume));
    out['nCsat' + k] = ids[k].map((id) => g(id, 'n_csat'));
    out['csat' + k] = ids[k].map((id) => g(id, 'csat'));
    out['tme' + k] = ids[k].map((id) => { const v = g(id, 'tme'); return v == null ? null : Math.round(Math.round(v) / 60 * 1e4) / 1e4; });     // minutos (4 casas: precisão abaixo de 1 s)
    out['tma' + k] = ids[k].map((id) => { const v = g(id, 'tma'); return v == null ? null : Math.round(Math.round(v) / 3600 * 1e5) / 1e5; });   // horas (5 casas: precisão abaixo de 1 s)
  }
  return out;
}
const ATEND_ONLY = (process.argv.find((a) => a.startsWith('--atend-only=')) || '').split('=')[1]?.split(',') || [];
const atendTeam = INTERCOM ? atendSeries(INTERCOM.equipe, 'volume') : null;

// ---------- selo de atualização (a partir da cadência real) ----------
function fmtBR(ms) { const d = local(ms); return pad(d.getUTCDate()) + '/' + pad(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear() + ' às ' + pad(d.getUTCHours()) + 'h' + pad(d.getUTCMinutes()); }
function nextRun(ms) {
  const c = cfg.cadencia;
  for (let k = 0; k <= 8; k++) {
    const L = local(ms + k * DAY);
    const slot = Date.UTC(L.getUTCFullYear(), L.getUTCMonth(), L.getUTCDate(), c.hora, c.minuto) - OFF;
    if (c.diasDaSemana.includes(L.getUTCDay()) && slot > ms + 5 * 60e3) return slot;
  }
  throw new Error('cadência inválida');
}

// ---------- metas ----------
// dias úteis (seg–sex) de um mês 'YYYY-MM' até um dia limite opcional 'YYYY-MM-DD' (inclusive)
function diasUteis(key, ate) {
  const [y, m] = key.split('-').map(Number); let n = 0;
  for (let d = 1; d <= 31; d++) { const dt = new Date(Date.UTC(y, m - 1, d)); if (dt.getUTCMonth() !== m - 1) break;
    const iso = dt.toISOString().slice(0, 10); if (ate && iso > ate) break; const w = dt.getUTCDay(); if (w >= 1 && w <= 5) n++; }
  return n;
}
const CORTE = ymd(NOW.getTime());
function metas(semanal) {
  return { metaS: P.weeks.map(() => semanal), metaD: P.days.map(() => Math.round(semanal / 5)),
    metaM: P.months.map((mo, i) => Math.round(semanal * diasUteis(mo.key, i === P.months.length - 1 ? CORTE : null) / 5)) };
}

// ---------- montagem ----------
// Assets compartilhados (sem dado pessoal), hospedados no repositório de assets:
//  base.js    = funções de gráfico + logo (grande, quase nunca muda)
//  paineis.js = renderização dos painéis (pequeno, muda quando há ajuste de layout)
//  app.css    = estilo
// Congelados em shared/: o build usa os congelados; com --rebuild-shared, regera dos templates.
const crypto = require('crypto');
const RB_ARG = process.argv.find((a) => a.startsWith('--rebuild-shared'));
const REBUILD_SET = RB_ARG ? (RB_ARG.includes('=') ? RB_ARG.split('=')[1].split(',') : ['base', 'paineis', 'app']) : [];
const FROZEN = path.join(ROOT, 'shared');
const frozen = (f) => path.join(FROZEN, f);
const baseSrc = T('_charts.js') + '\nvar LOGO_SVG = ' + JSON.stringify(T('_logo.svg')) + ';\n';
const paineisSrc = T('_render_common.js') + '\n' + T('_render_agendamento.js') + '\n' + T('_render_prestador.js') + '\n' + T('_render_equipe.js') + '\n' + T('_boot.js');
const useFrozen = (f) => !REBUILD_SET.includes(f.split('.')[0]) && fs.existsSync(frozen(f));
const BASE_JS = useFrozen('base.js') ? fs.readFileSync(frozen('base.js'), 'utf8') : minJS(baseSrc);
const PAINEIS_JS = useFrozen('paineis.js') ? fs.readFileSync(frozen('paineis.js'), 'utf8') : minJS(paineisSrc);
const SHARED_CSS = useFrozen('app.css') ? fs.readFileSync(frozen('app.css'), 'utf8') : execFileSync('csso', [], { input: T('_app.css') }).toString().trim();
const ver = (x) => crypto.createHash('sha256').update(x).digest('hex').slice(0, 10);
const BASE = cfg.github.assetsBase || ('https://' + cfg.github.owner.toLowerCase() + '.github.io/' + cfg.github.assetsRepo + '/');
const URLS = { css: BASE + 'app.css?v=' + ver(SHARED_CSS), base: BASE + 'base.js?v=' + ver(BASE_JS), paineis: BASE + 'paineis.js?v=' + ver(PAINEIS_JS) };

function pessoaAgend(p) {
  const own = agendMetrics([p.ownerId]);
  own.backlog = agg.backlog[p.ownerId] || 0;
  own.hasData = own.ticketsM.some((v) => v > 0) || own.recM.some((v) => v > 0);
  Object.assign(own, metas(p.metaSemanal));
  return own;
}

function buildPage(p) {
  const D = { role: p.papel, name: p.nome, first: p.primeiroNome, labelsM: P.months.map((m) => m.label),
    labelsS: P.weeks.map((w) => w.label), labelsDias: P.days.map((d) => d.label), weekRanges: P.weeks.map((w) => w.label + ' ' + w.range), team };
  if (p.papel === 'agendamento') { const cl = local(NOW.getTime()); D.own = pessoaAgend(p); D.metaSemanal = p.metaSemanal; if (INTERCOM && (!ATEND_ONLY.length || ATEND_ONLY.includes(p.slug))) { const ag = intercomAgente(p); D.atend = { own: ag ? atendSeries(INTERCOM.agentes[ag], 'fechadas') : null, team: atendTeam, nome: ag, labelsD: ATEND_DIAS.map((d) => d.key.slice(8, 10) + '/' + d.key.slice(5, 7)) }; } D.corte = pad(cl.getUTCDate()) + '/' + pad(cl.getUTCMonth() + 1); }
  else if (p.papel === 'prestador') { D.prest = prestData(p); }
  else if (p.papel === 'equipe') {
    const ag = cfg.pessoas.filter((x) => x.papel === 'agendamento');
    const mt = metas(ag.reduce((s, x) => s + x.metaSemanal, 0));
    const corteL = local(NOW.getTime());
    D.eq = { metaSemanalEquipe: ag.reduce((s, x) => s + x.metaSemanal, 0), metaS: mt.metaS, metaM: mt.metaM,
      corte: pad(corteL.getUTCDate()) + '/' + pad(corteL.getUTCMonth() + 1),
      pessoas: ag.map((x) => { const o = pessoaAgend(x); return { first: x.primeiroNome, metaSemanal: x.metaSemanal, potM: o.potM, potS: o.potS, metaM: o.metaM, metaS: o.metaS, ticketsM: o.ticketsM, ticketsS: o.ticketsS, diasM: o.diasM, diasS: o.diasS, backlog: o.backlog }; }) };
    const pr = cfg.pessoas.find((x) => x.papel === 'prestador');
    if (pr) D.prest = Object.assign({ first: pr.primeiroNome }, prestData(pr));
  }
  const body = T(p.papel + '.body.html').replace('{{VISAO_GERAL}}', T('_visao_geral.html')).replace('{{ATEND_PESSOA}}', D.atend ? T('_atend_pessoa.html') : '');
  const titulo = p.papel === 'equipe' ? 'Painel da equipe Ongoing SMB (KPIs)' : 'Olá, ' + p.primeiroNome + '! Este é o seu painel de indicadores (KPIs)';
  const header = T('_header.html').replace('Olá, {{FIRST_NAME}}! Este é o seu painel de indicadores (KPIs)', titulo)
    .replace('{{LAST_UPDATE}}', fmtBR(NOW.getTime())).replace('{{NEXT_UPDATE}}', fmtBR(nextRun(NOW.getTime())));
  const dataScript = '/*__DATA_BEGIN__*/var D=' + JSON.stringify(D) + ';/*__DATA_END__*/';
  const shell = minHTMLShell(T('_head.html').replace('{{TITLE}}', p.papel === 'equipe' ? 'SMB · Equipe' : 'SMB · ' + p.primeiroNome).replace('{{CSS_URL}}', URLS.css) + '\n' + header + '\n' + body);
  const html = shell + '\n<script>' + dataScript + '</script>\n<script src="' + URLS.base + '"></script>\n<script src="' + URLS.paineis + '"></script>\n</body></html>\n';
  const roleSrc = T('_render_common.js') + T('_render_' + p.papel + '.js') + T('_boot.js').replace(/renderAgendamento\(\)|renderPrestador\(\)|renderEquipe\(\)/g, '');
  return { html, script: dataScript + '\n' + BASE_JS + '\n' + PAINEIS_JS, roleSrc, D };
}

// ---------- verificações ----------
function verify(p, html, script, roleSrc) {
  const errs = [];
  const opens = (html.match(/<div\b/g) || []).length, closes = (html.match(/<\/div>/g) || []).length;
  if (opens !== closes) errs.push(`divs desbalanceadas: ${opens} abertas x ${closes} fechadas`);
  if (/\{\{[A-Z_]+\}\}/.test(html)) errs.push('placeholder {{...}} não substituído');
  // Cuidado #1: array de meses sem aspas é JS válido e só quebra no navegador
  const unq = html.match(/\[\s*(Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)\/\d{2}/);
  if (unq) errs.push('rótulo de mês sem aspas: ' + unq[0]);
  try { new vm.Script(script); } catch (e) { errs.push('sintaxe JS: ' + e.message); }
  // Cuidado #2: todo id referenciado no JS precisa existir no HTML
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const refs = new Set([...roleSrc.matchAll(/(?:getElementById|dashLegend|dashSingleAxisLineChart|dashComboChart|dashGoalBarChart|showPending|bindToggle|setText|setHTML)\(\s*'([^']+)'/g)].map((m) => m[1]));
  const semAtend = !ids.has('atend-wrap');
  for (const r of refs) if (!ids.has(r) && !/^leg-ind-$|^c-ind-$/.test(r) && !(semAtend && /atend/.test(r))) errs.push(`JS referencia id inexistente: #${r}`);
  // Smoke test em runtime (pega o que node --check não pega): executa o script com um DOM falso
  try { smoke(script, ids); } catch (e) { errs.push('erro em runtime: ' + (e && e.message)); }
  return errs;
}
function smoke(script, ids) {
  const handlers = [];
  const noop = () => {};
  const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : k === 'measureText' ? () => ({ width: 30 }) : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? () => ({ data: [] }) : noop), set: (t, k, v) => { t[k] = v; return true; } });
  const mkEl = (id) => ({ id, hidden: false, style: {}, innerHTML: '', textContent: '', width: 0, height: 0,
    getContext: () => ctx, getBoundingClientRect: () => ({ width: 600, height: 300 }),
    addEventListener: (ev, fn) => handlers.push({ id, fn }), querySelectorAll: () => [], classList: { add: noop, remove: noop } });
  const els = {};
  const document = { getElementById: (id) => (ids.has(id) ? (els[id] = els[id] || mkEl(id)) : null), createElement: () => mkEl('_scratch') };
  let q = [];
  const sandbox = { document, window: { devicePixelRatio: 2 }, requestAnimationFrame: (f) => q.push(f), console, Math, JSON, Date };
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox, { timeout: 5000 });
  const frames = () => { for (let i = 0; i < 40; i++) { const cur = q; q = []; cur.forEach((f) => f()); } };
  frames();
  for (const h of handlers) for (const view of ['mensal', 'semanal', 'diario']) {
    const btn = { getAttribute: () => view, classList: { add: noop, remove: noop } };
    h.fn({ target: { closest: () => btn }, currentTarget: { querySelectorAll: () => [] } });
    frames();
  }
}

// ---------- main ----------
const report = { geradoEm: NOW.toISOString(), meses: P.months, semanas: P.weeks, paineis: [] };
let failed = false;
for (const p of cfg.pessoas) {
  const { html, script, roleSrc, D } = buildPage(p);
  const errs = verify(p, html, script, roleSrc);
  const out = path.join(ROOT, 'dist', p.slug);
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'index.html'), html);
  report.paineis.push({ slug: p.slug, ok: !errs.length, erros: errs, own: D.own && { metaS: D.own.metaS, metaM: D.own.metaM, potS: D.own.potS, ticketsM: D.own.ticketsM, ticketsS: D.own.ticketsS, potM: D.own.potM, diasM: D.own.diasM, realM: D.own.realM, recM: D.own.recM, backlog: D.own.backlog, hasData: D.own.hasData }, prest: D.prest, atend: D.atend });
  console.log((errs.length ? '✗ ' : '✓ ') + p.slug + (errs.length ? '\n   - ' + errs.join('\n   - ') : ''));
  if (errs.length) failed = true;
}
report.equipe = team;
fs.mkdirSync(path.join(ROOT, 'dist', 'shared'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist', 'shared', 'base.js'), BASE_JS);
fs.writeFileSync(path.join(ROOT, 'dist', 'shared', 'paineis.js'), PAINEIS_JS);
fs.writeFileSync(path.join(ROOT, 'dist', 'shared', 'app.css'), SHARED_CSS);
report.assets = URLS;
fs.writeFileSync(path.join(ROOT, 'dist', 'report.json'), JSON.stringify(report, null, 2));
if (failed) { console.error('\nVERIFICAÇÃO FALHOU — não publique.'); process.exit(1); }
console.log('\nTudo verificado. dist/ pronto para publicar.');
