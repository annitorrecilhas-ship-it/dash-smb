// Métricas de atendimento do time Ongoing SMB pela Reporting Data Export API da Intercom.
// Regras de cálculo: prompt "puxar métricas de suporte da Intercom via API" (validado contra relatórios oficiais).
// Chave: process.env.INTERCOM_TOKEN (secret do GitHub Actions). Nunca é impressa nem gravada.
// Saída: dados/intercom_smb.json, só com métricas agregadas por período (sem conversas, sem clientes).
import fs from 'node:fs';

const EQUIPE = 'Ongoing SMB';
const CANAIS = ['WhatsApp', 'Conversa'];
const OFF = 3; // UTC-3 fixo

const token = process.env.INTERCOM_TOKEN;
if (!token) { console.error('INTERCOM_TOKEN não configurado. Configure o secret e rode de novo.'); process.exit(1); }
const H = { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json', 'Intercom-Version': '2.16' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- API ----------
async function once(dataset_id, attribute_ids, start, end) {
  const res = await fetch('https://api.intercom.io/export/reporting_data/enqueue',
    { method: 'POST', headers: H, body: JSON.stringify({ dataset_id, attribute_ids, start_time: start, end_time: end }) });
  const d = await res.json().catch(() => ({}));
  if (res.status === 429) { const e = new Error('rate_limit'); e.rate = true; throw e; }
  if (!res.ok) throw new Error(`enqueue ${dataset_id} HTTP ${res.status}: ${JSON.stringify(d).slice(0, 300)}`);
  let job = null;
  for (let i = 0; i < 120; i++) {
    await sleep(2500);
    const j = await (await fetch(`https://api.intercom.io/export/reporting_data/${d.job_identifier}`, { headers: H })).json();
    if (j.status === 'failed') throw new Error(`job failed (${dataset_id})`);
    if (j.status === 'complete' && j.download_url) { job = j; break; }
  }
  if (!job) throw new Error(`timeout (${dataset_id})`);
  const r = await fetch(job.download_url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/octet-stream' } });
  if (!r.ok) throw new Error(`download ${dataset_id} HTTP ${r.status}`);
  return r.text();
}
async function pull(dataset, attrs, start, end) {
  for (let t = 1; t <= 12; t++) {
    try { const csv = await once(dataset, attrs, start, end); return parseCSV(csv); }
    catch (e) { console.log(`  tentativa ${t}/12 falhou (${dataset}): ${e.message}`); if (t === 12) throw e; await sleep(e.rate ? 30000 : 5000); }
  }
}

// ---------- CSV (aspas, vírgulas e quebras de linha dentro de campos) ----------
function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  const head = (rows.shift() || []).map((h) => h.trim().replace(/^[a-z-]+\./, ''));
  return rows.filter((r) => r.length > 1 || (r[0] || '') !== '').map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}

// ---------- utilidades ----------
const num = (v) => { if (v === undefined || v === null || v === '') return null; const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
function median(a) { const b = a.filter((x) => x !== null).sort((x, y) => x - y); if (!b.length) return null; const h = b.length >> 1; return Math.round(b.length % 2 ? b[h] : (b[h - 1] + b[h]) / 2); }
const pct = (n, d) => (d ? Math.round(1000 * n / d) / 10 : null);
const inCanal = (r) => CANAIS.includes(r.channel);
// data/hora do CSV (fuso do workspace) -> epoch, com UTC-3 fixo
function toEpoch(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(s || '');
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] + OFF, +m[5], +(m[6] || 0)) / 1000 : null;
}
function groupBy(rows, key) { const g = {}; for (const r of rows) { const k = r[key]; if (!k) continue; (g[k] = g[k] || []).push(r); } return g; }

// ---------- períodos (UTC-3 fixo) ----------
const dayStart = (y, m, d) => Date.UTC(y, m - 1, d, OFF, 0, 0) / 1000;
const iso = (t) => new Date((t - OFF * 3600) * 1000).toISOString().slice(0, 10);
const nowL = new Date(Date.now() - OFF * 3600e3); // relógio BRT lido com getUTC*
const hoje = dayStart(nowL.getUTCFullYear(), nowL.getUTCMonth() + 1, nowL.getUTCDate());
const periodos = [];
for (let k = 3; k >= 0; k--) {
  const d = new Date(Date.UTC(nowL.getUTCFullYear(), nowL.getUTCMonth() - k, 1));
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, key = `${y}-${String(m).padStart(2, '0')}`;
  const ini = dayStart(y, m, 1);
  if (k > 0) periodos.push({ tipo: 'mes', key, start: ini, end: dayStart(y, m + 1, 1) - 1 });
  else if (hoje - 1 >= ini) periodos.push({ tipo: 'mtd', key, start: ini, end: hoje - 1 });   // MTD = dia 1 até ontem
}
const dow = (nowL.getUTCDay() + 6) % 7; // 0 = segunda
const segunda = hoje - dow * 86400;
for (let k = 3; k >= 1; k--) { const s = segunda - 7 * k * 86400; periodos.push({ tipo: 'semana', key: iso(s), start: s, end: s + 7 * 86400 - 1 }); }

// ---------- coleta por período ----------
const DS = {
  sla: ['conversation_sla_status_log', ['standard.conversation_id', 'standard.sla_metric_type', 'standard.sla_state', 'team.currently_assigned_team_id', 'standard.channel', 'teammate.sla_attributed_to_teammate_id']],
  csat: ['conversation_rating_sent', ['standard.conversation_id', 'conversation-rating-sent.conversation_rating', 'team.currently_assigned_team_id', 'standard.channel', 'standard.conversation_started_by', 'conversation-rating-sent.rated_teammate_id']],
  part: ['consolidated_conversation_part', ['standard.conversation_id', 'duration.team_first_response_time_in_office_hours', 'duration.teammate_first_response_time_in_office_hours', 'team.action_team_assignee_id', 'standard.channel', 'teammate.action_performed_by_teammate_id', 'standard.conversation_started_by', 'standard.action_type']],
  conv: ['conversation', ['standard.conversation_id', 'standard.channel', 'team.currently_assigned_team_id', 'timestamp.conversation_started_at',
    'duration.time_from_first_assignment_to_close_in_office_hours', 'duration.time_to_close_excluding_bot_inbox_in_office_hours',
    'duration.time_to_first_close_excluding_bot_inbox_in_office_hours', 'teammate.first_closing_teammate_id']]
};
const distintos = {}; // valores distintos de colunas-chave, para conferir os textos do workspace
function anota(nome, rows, cols) { for (const c of cols) { const s = (distintos[`${nome}.${c}`] = distintos[`${nome}.${c}`] || new Set()); for (const r of rows) if (r[c]) s.add(r[c]); } }

const out = { gerado_em: new Date().toISOString(), equipe_nome: EQUIPE, canais: CANAIS, periodos: [], equipe: {}, agentes: {} };
const setAg = (nome, key, campo, v) => { ((out.agentes[nome] = out.agentes[nome] || {})[key] = out.agentes[nome][key] || {})[campo] = v; };

// TMA/Volume: uma exportação só, janela ampliada 30 dias para trás; filtro local por conversation_started_at
const minStart = Math.min(...periodos.map((p) => p.start)), maxEnd = Math.max(...periodos.map((p) => p.end));
console.log('Exportando conversation (janela ampliada)...');
const convRows = await pull(DS.conv[0], DS.conv[1], minStart - 30 * 86400, maxEnd);
anota('conversation', convRows, ['channel', 'currently_assigned_team_id']);
console.log(`  ${convRows.length} linhas`);

for (const p of periodos) {
  console.log(`Período ${p.tipo} ${p.key} (${iso(p.start)} a ${iso(p.end)})`);
  const cheio = p.tipo === 'mes';
  const E = (out.equipe[p.key + (p.tipo === 'semana' ? '@S' : '')] = {});
  const K = p.key + (p.tipo === 'semana' ? '@S' : '');
  out.periodos.push({ tipo: p.tipo, key: p.key, id: K, inicio: iso(p.start), fim: iso(p.end) });

  // SLA
  const sla = await pull(DS.sla[0], DS.sla[1], p.start, p.end);
  anota('sla', sla, ['sla_metric_type', 'sla_state', 'channel', 'currently_assigned_team_id']);
  const slaCalc = (rows) => {
    const f = rows.filter((r) => r.sla_metric_type === 'Tempo de primeira resposta'), s = rows.filter((r) => r.sla_metric_type === 'Próximo tempo de resposta');
    return { sla1: pct(f.filter((r) => r.sla_state === 'Toque').length, f.length), n_sla1: f.length,
             slaSub: pct(s.filter((r) => r.sla_state === 'Toque').length, s.length), n_slaSub: s.length };
  };
  const slaEq = sla.filter((r) => r.currently_assigned_team_id === EQUIPE && inCanal(r));
  Object.assign(E, slaCalc(slaEq));
  for (const [ag, rows] of Object.entries(groupBy(cheio ? slaEq : sla.filter(inCanal), 'sla_attributed_to_teammate_id'))) {
    const v = slaCalc(rows); for (const c in v) setAg(ag, K, c, v[c]);
  }

  // CSAT
  const cs = (await pull(DS.csat[0], DS.csat[1], p.start, p.end)).filter((r) => r.conversation_rating !== '');
  anota('csat', cs, ['conversation_started_by', 'channel']);
  const csatCalc = (rows) => { const n = rows.map((r) => num(r.conversation_rating)).filter((x) => x !== null); return { csat: pct(n.filter((x) => x >= 4).length, n.length), n_csat: n.length }; };
  const csEq = cs.filter((r) => r.currently_assigned_team_id === EQUIPE && inCanal(r) && r.conversation_started_by === 'Cliente');
  Object.assign(E, csatCalc(csEq));
  for (const [ag, rows] of Object.entries(groupBy(cheio ? csEq : cs, 'rated_teammate_id'))) { const v = csatCalc(rows); for (const c in v) setAg(ag, K, c, v[c]); }

  // TME e conversas fechadas
  const part = await pull(DS.part[0], DS.part[1], p.start, p.end);
  anota('part', part, ['action_type', 'conversation_started_by', 'channel']);
  E.tme = median(part.filter((r) => r.action_team_assignee_id === EQUIPE && inCanal(r)).map((r) => num(r.team_first_response_time_in_office_hours)));
  for (const [ag, rows] of Object.entries(groupBy(part.filter((r) => r.conversation_started_by === 'Cliente'), 'action_performed_by_teammate_id')))
    setAg(ag, K, 'tme', median(rows.map((r) => num(r.teammate_first_response_time_in_office_hours))));
  for (const [ag, rows] of Object.entries(groupBy(part.filter((r) => ['Fechar', 'Responder, Fechar'].includes(r.action_type)), 'action_performed_by_teammate_id')))
    setAg(ag, K, 'fechadas', new Set(rows.map((r) => r.conversation_id)).size);

  // TMA e Volume (dataset conversation, filtro local pela data de início)
  const cv = convRows.filter((r) => { const t = toEpoch(r.conversation_started_at); return t !== null && t >= p.start && t <= p.end; });
  const cvEq = cv.filter((r) => r.currently_assigned_team_id === EQUIPE && inCanal(r));
  E.volume = new Set(cvEq.map((r) => r.conversation_id)).size;
  E.tma = median(cvEq.map((r) => num(p.tipo === 'semana' ? r.time_from_first_assignment_to_close_in_office_hours : r.time_to_close_excluding_bot_inbox_in_office_hours)));
  for (const [ag, rows] of Object.entries(groupBy(cvEq, 'first_closing_teammate_id')))
    setAg(ag, K, 'tma', median(rows.map((r) => num(r.time_to_first_close_excluding_bot_inbox_in_office_hours))));
  console.log(`  equipe: volume ${E.volume} | SLA1 ${E.sla1}% | SLAsub ${E.slaSub}% | CSAT ${E.csat}% (${E.n_csat}) | TME ${E.tme}s | TMA ${E.tma}s`);
}

out.valores_distintos = Object.fromEntries(Object.entries(distintos).map(([k, s]) => [k, [...s].slice(0, 40)]));
out.avisos = [];
const v = (k) => out.valores_distintos[k] || [];
if (!v('sla.sla_state').includes('Toque')) out.avisos.push('Valor "Toque" não apareceu em sla_state: conferir o idioma do workspace.');
if (!v('conversation.currently_assigned_team_id').includes(EQUIPE)) out.avisos.push(`Equipe "${EQUIPE}" não apareceu no dataset conversation.`);
if (!CANAIS.every((c) => v('conversation.channel').includes(c))) out.avisos.push('Algum canal configurado não apareceu nos dados: ' + JSON.stringify(v('conversation.channel')));
fs.mkdirSync('dados', { recursive: true });
fs.writeFileSync('dados/intercom_smb.json', JSON.stringify(out, null, 1));
console.log('Avisos:', out.avisos.length ? out.avisos.join(' | ') : 'nenhum');
console.log('Atendentes encontrados:', Object.keys(out.agentes).length);
