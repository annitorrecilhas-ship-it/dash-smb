function renderAgendamento(){
  var O = D.own, T = D.team, me = D.first + ' (você)';
  setText('lbl-first-month', D.labelsM[0].replace('*',''));
  document.getElementById('stat-backlog').textContent = dashFmtInt(O.backlog);
  renderMetaStrip();

  if(!O.hasData){
    document.getElementById('own-wrap').hidden = true;
    document.getElementById('own-empty').hidden = false;
  } else {
    dashLegend('leg-own', [{label: me + ' — tickets', color: DASH_C.royal}, {label:'Etapa (equipe)', color: ORANGE}]);
    dashSingleAxisLineChart('c-own-mensal', { labels: D.labelsM, series: [
      { label: me, color: DASH_C.royal, values: O.ticketsM, area:true },
      { label:'Etapa (equipe)', color: ORANGE, values: T.ticketsM, dashed:true, fixed:true, hideLabels:true }
    ], unit:'int', speed:0.75 });
    dashSingleAxisLineChart('c-own-semanal', { labels: D.labelsS, series: [
      { label: me, color: DASH_C.royal, values: O.ticketsS, area:true },
      { label:'Etapa (equipe)', color: ORANGE, values: T.ticketsS, dashed:true, fixed:true, hideLabels:true }
    ], unit:'int', speed:0.75 });
    function part(own, team, labels){
      return labels.map(function(l, i){ return l + ' ' + (team[i] ? fmtPct1(100*own[i]/team[i]) : '—'); }).join(' · ');
    }
    setHTML('note-part-m', '<strong>Sua participação na equipe</strong> (tickets seus ÷ tickets da equipe) — ' + part(O.ticketsM, T.ticketsM, D.labelsM) + '.');
    setHTML('note-part-s', '<strong>Sua participação na equipe</strong> — ' + part(O.ticketsS, T.ticketsS, D.weekRanges) + '.');

    function drawPotDias(view){
      var k = view === 'diario' ? 'D' : view === 'semanal' ? 'S' : 'M';
      var labels = k === 'D' ? D.labelsDias : k === 'S' ? D.labelsS : D.labelsM;
      var metaLbl = k === 'D' ? 'Meta (' + O.metaD[0] + '/dia útil)' : 'Meta (' + D.metaSemanal + '/semana)';
      dashLegend('leg-potreal', [{label:'Veículos agendados', color: DASH_C.royal}, {label: metaLbl, color: ORANGE}]);
      dashGoalBarChart('c-potreal', { labels: labels, values: O['pot' + k], goals: O['meta' + k], barColor: DASH_C.royal, lineColor: ORANGE });
      dashLegend('leg-dias', [{label: me, color: DASH_C.ok}, {label:'Etapa (equipe)', color: ORANGE}]);
      dashSingleAxisLineChart('c-dias', { labels: labels, series: [
        { label: me, color: DASH_C.ok, values: O['dias' + k], area:true, fmt: fmtDias },
        { label:'Etapa (equipe)', color: ORANGE, values: T['dias' + k], dashed:true, fixed:true, hideLabels:true, fmt: fmtDias }
      ], unit:'int', speed:0.75 });
    }
    drawPotDias('semanal');
    bindToggle('potdias-toggle', drawPotDias);

    var rr = [{ label:'Realizado', color: DASH_C.ok, values: O.realM }, { label:'Recebido', color: ORANGE, values: O.recM }];
    dashLegend('leg-recrel-own', rr);
    dashSingleAxisLineChart('c-recrel-own', { labels: D.labelsM, series: rr, unit:'int', speed:0.75 });
  }
}

// Cartões de agendado x meta no topo (aparecem mesmo sem tickets no período)
function renderMetaStrip(){
  var O = D.own, nS = O.potS.length, nM = O.potM.length;
  function card(lbl, v, meta){
    var pct = meta ? Math.round(100 * v / meta) : null;
    var cls = pct == null ? 'mc-warn' : (pct >= 100 ? 'mc-ok' : (pct >= 80 ? 'mc-warn' : 'mc-bad'));
    return '<div class="meta-card"><div class="mc-lbl">' + lbl + '</div><div class="mc-num">' + dashFmtInt(v) + ' <small>/ ' + dashFmtInt(meta) + '</small></div>' +
      '<span class="mc-pct ' + cls + '">' + (pct == null ? '—' : pct + '% da meta') + '</span></div>';
  }
  setHTML('meta-strip',
    card('Última semana · ' + D.weekRanges[nS - 1].replace(/^S-1 /, ''), O.potS[nS - 1], O.metaS[nS - 1]) +
    card('Semana anterior · ' + D.weekRanges[nS - 2].replace(/^S-2 /, ''), O.potS[nS - 2], O.metaS[nS - 2]) +
    card('Mês atual · ' + D.labelsM[nM - 1].replace('*', '') + ' até ' + D.corte, O.potM[nM - 1], O.metaM[nM - 1]));
}

// Atendimento (Intercom) — só aparece quando o build inclui D.atend
function renderAtendimento(){
  var A = D.atend; if (!A) return;
  var O = A.own, T = A.team, me = D.first + ' (você)';
  if (!O) { showPending('atend-wrap', 'atend-toggle', '<strong>Ainda não encontramos seu usuário no Intercom.</strong> Assim que ele for vinculado, seus números de atendimento aparecem aqui.'); return; }
  function draw(view){
    var k = view === 'semanal' ? 'S' : view === 'diario' ? 'D' : 'M';
    var labels = k === 'S' ? D.labelsS : k === 'D' ? A.labelsD : D.labelsM;
    function duo(key){ return [{ label: me, color: DASH_C.royal, values: O[key + k] }, { label: 'Equipe', color: ORANGE, values: T[key + k], dashed: true, hideLabels: true }]; }
    var csat = duo('csat');
    dashLegend('leg-atend-csat', csat);
    dashSingleAxisLineChart('c-atend-csat', { labels: labels, series: csat, unit: 'pct' });
    var conv = [{ label: me, color: DASH_C.royal, values: O['conv' + k] }];
    dashLegend('leg-atend-conv', conv);
    dashSingleAxisLineChart('c-atend-conv', { labels: labels, series: conv, unit: 'int' });
    var tme = duo('tme');
    dashLegend('leg-atend-tme', tme);
    dashSingleAxisLineChart('c-atend-tme', { labels: labels, series: tme, unit: 'minutes' });
    var tma = duo('tma');
    dashLegend('leg-atend-tma', tma);
    dashSingleAxisLineChart('c-atend-tma', { labels: labels, series: tma, unit: 'hours' });
    var n = O['nCsat' + k], L = k === 'S' ? D.weekRanges : labels;
    setHTML('note-atend', '<strong>Como ler:</strong> CSAT = % de avaliações com nota 4 ou 5 (avaliações recebidas: ' + L.map(function(l, i){ return l + ' ' + dashFmtInt(n[i]); }).join(' · ') + '). ' +
      'Conversas fechadas = conversas que você fechou no Intercom, pela data do fechamento (a soma das pessoas não bate com o volume da equipe, e isso é esperado). ' +
      'TME = tempo da sua 1ª resposta; TMA = tempo até o 1º fechamento; ambos em horário comercial (mediana). A linha laranja é a equipe. ' +
      'Mês atual = dia 1 até ontem. Diário = últimos ' + A.labelsD.length + ' dias úteis (sem fins de semana e feriados).');
  }
  if (!A.labelsD.length) {   // sem dados diários: esconde o botão Diário
    var tg = document.getElementById('atend-toggle');
    if (tg) Array.prototype.forEach.call(tg.querySelectorAll('button[data-view="diario"]'), function(b){ b.style.display = 'none'; });
  }
  draw('mensal'); bindToggle('atend-toggle', function(v){ if (v === 'diario' && !A.labelsD.length) return; draw(v); });
}
