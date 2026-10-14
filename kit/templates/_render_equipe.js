function renderEquipe(){
  var E = D.eq, T = D.team;
  var CORES = [DASH_C.royal, DASH_C.ok, DASH_C.warn, DASH_C.danger, DASH_C.mist, DASH_C.inkSoft];
  setText('lbl-meta-equipe', dashFmtInt(E.metaSemanalEquipe) + ' veículos');
  function drawMeta(view){
    var k = view === 'diario' ? 'D' : view === 'mensal' ? 'M' : 'S';
    var labels = k === 'D' ? D.labelsDias : k === 'S' ? D.labelsS : D.labelsM;
    var metaLbl = k === 'D' ? 'Meta da equipe (' + dashFmtInt(E.metaD[0]) + '/dia útil)' : 'Meta da equipe';
    dashLegend('leg-eq-meta', [{label:'Veículos agendados (equipe)', color: DASH_C.royal}, {label: metaLbl, color: ORANGE}]);
    dashGoalBarChart('c-eq-meta', { labels: labels, values: T['pot' + k], goals: E['meta' + k], barColor: DASH_C.royal, lineColor: ORANGE });
  }
  drawMeta('semanal'); bindToggle('eq-meta-toggle', drawMeta);

  function drawPessoa(view){
    var k = view === 'dia' ? 'D' : view === 'mes' ? 'M' : 'S', P = E.pessoas;
    var last = function(a){ return a[a.length - 1]; };
    setText('lbl-pessoa-periodo', k === 'D' ? 'Último dia útil · ' + last(D.labelsDias) : k === 'S' ? last(D.weekRanges) : last(D.labelsM) + ' até ' + E.corte);
    var vals = P.map(function(p){ return last(p['pot' + k]); });
    var goals = P.map(function(p){ return last(p['meta' + k]); });
    dashLegend('leg-eq-pessoa', [{label:'Veículos agendados', color: DASH_C.royal}, {label:'Meta individual', color: ORANGE}]);
    dashGoalBarChart('c-eq-pessoa', { labels: P.map(function(p){ return p.first; }), values: vals, goals: goals, barColor: DASH_C.royal, lineColor: ORANGE });
    setHTML('note-eq-pessoa', '<strong>Atingimento</strong> — ' + P.map(function(p, i){ return p.first + ' ' + (goals[i] ? Math.round(100 * vals[i] / goals[i]) + '%' : '—') + ' (meta ' + dashFmtInt(goals[i]) + ')'; }).join(' · ') + '. Meta semanal: ' + P.map(function(p){ return p.first + ' ' + p.metaSemanal; }).join(', ') + '. Meta diária = semanal ÷ 5 por dia útil. Meta mensal = semanal × dias úteis ÷ 5 (mês atual proporcional até ' + E.corte + ').');
  }
  drawPessoa('semana'); bindToggle('eq-pessoa-toggle', drawPessoa);

  function drawEvol(view){
    var k = view === 'diario' ? 'D' : view === 'semanal' ? 'S' : 'M';
    var labels = k === 'D' ? D.labelsDias : k === 'S' ? D.labelsS : D.labelsM;
    var tk = E.pessoas.map(function(p, i){ return { label: p.first, color: CORES[i % CORES.length], values: p['tickets' + k] }; });
    dashLegend('leg-eq-tickets', tk);
    dashSingleAxisLineChart('c-eq-tickets', { labels: labels, series: tk, unit:'int', speed:0.75 });
    var di = E.pessoas.map(function(p, i){ return { label: p.first, color: CORES[i % CORES.length], values: p['dias' + k], fmt: fmtDias }; });
    di.push({ label:'Equipe', color: ORANGE, values: T['dias' + k], dashed:true, fixed:true, hideLabels:true, fmt: fmtDias });
    dashLegend('leg-eq-dias', di);
    dashSingleAxisLineChart('c-eq-dias', { labels: labels, series: di, unit:'int', speed:0.75 });
  }
  drawEvol('mensal'); bindToggle('eq-evol-toggle', drawEvol);

  setHTML('eq-backlog', E.pessoas.map(function(p){ return '<div class="stat-card"><div class="stat-num">' + dashFmtInt(p.backlog) + '</div><div class="stat-lbl">' + p.first + '</div></div>'; }).join(''));

  if (D.prest) {
    setText('lbl-prest-nome', D.prest.first);
    dashSingleAxisLineChart('c-eq-sla-m', { labels: D.labelsM, series: [{ label: D.prest.first, color: DASH_C.ok, values: D.prest.slaM }], unit:'pct' });
    dashSingleAxisLineChart('c-eq-sla-s', { labels: D.labelsS, series: [{ label: D.prest.first, color: DASH_C.ok, values: D.prest.slaS }], unit:'pct' });
  }
  renderAtendEquipe(CORES);
}

// Atendimento (Intercom) por pessoa — só aparece quando o build inclui D.atend
function renderAtendEquipe(CORES){
  var A = D.atend; if (!A) return;
  var P = A.pessoas.map(function(p, i){ return { first: p.first, s: p.s, cor: CORES[i % CORES.length] }; }).filter(function(p){ return p.s; });
  var last = function(a){ return a[a.length - 1]; };
  function draw(view){
    var k = view === 'semanal' ? 'S' : view === 'diario' ? 'D' : 'M';
    var labels = k === 'S' ? D.labelsS : k === 'D' ? A.labelsD : D.labelsM;
    function ser(key, team){
      var out = P.map(function(p){ return { label: p.first, color: p.cor, values: p.s[key + k], hideLabels: true }; });
      if (team) out.push({ label: 'Equipe', color: ORANGE, values: A.team[key + k], dashed: true, fixed: true, hideLabels: true });
      return out;
    }
    var csat = ser('csat', true), conv = ser('conv', false), tme = ser('tme', true), tma = ser('tma', true);
    dashLegend('leg-eq-atend-csat', csat); dashSingleAxisLineChart('c-eq-atend-csat', { labels: labels, series: csat, unit: 'pct' });
    dashLegend('leg-eq-atend-conv', conv); dashSingleAxisLineChart('c-eq-atend-conv', { labels: labels, series: conv, unit: 'int' });
    dashLegend('leg-eq-atend-tme', tme); dashSingleAxisLineChart('c-eq-atend-tme', { labels: labels, series: tme, unit: 'minutes' });
    dashLegend('leg-eq-atend-tma', tma); dashSingleAxisLineChart('c-eq-atend-tma', { labels: labels, series: tma, unit: 'hours' });
    var per = k === 'S' ? last(D.weekRanges) : last(labels) + (k === 'M' ? ' (até ontem)' : '');
    var linha = function(nome, o, campoConv){ return '<strong>' + nome + '</strong>: ' + dashFmtInt(last(o[campoConv + k])) + ' conversas · CSAT ' + fmtPct1(last(o['csat' + k])) + ' (' + dashFmtInt(last(o['nCsat' + k])) + ' aval.) · TME ' + dashFmtMinSec(last(o['tme' + k])) + ' · TMA ' + presFmtDuration(last(o['tma' + k])); };
    setHTML('note-eq-atend', '<strong>' + per + '</strong> — ' + P.map(function(p){ return linha(p.first, p.s, 'conv'); }).concat([linha('Equipe', A.team, 'conv')]).join(' &nbsp;|&nbsp; ') +
      '.<br>CSAT = % de avaliações com nota 4 ou 5. Conversas fechadas = fechadas pela pessoa, pela data do fechamento (no total da equipe, conversas do time). TME = 1ª resposta; TMA = até o 1º fechamento; ambos em horário comercial (mediana). A linha laranja tracejada é a equipe. Diário = últimos ' + A.labelsD.length + ' dias úteis.');
  }
  if (!A.labelsD.length) { var tg = document.getElementById('atend-toggle'); if (tg) Array.prototype.forEach.call(tg.querySelectorAll('button[data-view="diario"]'), function(b){ b.style.display = 'none'; }); }
  draw('mensal'); bindToggle('atend-toggle', function(v){ if (v === 'diario' && !A.labelsD.length) return; draw(v); });
}
