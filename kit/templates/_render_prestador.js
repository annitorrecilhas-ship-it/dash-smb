function renderPrestador(){
  var P = D.prest, me = D.first + ' (você)';
  setText('lbl-first-month', D.labelsM[0].replace('*',''));
  dashSingleAxisLineChart('c-own-mensal', { labels: D.labelsM, series: [{ label: me, color: DASH_C.ok, values: P.slaM }], unit:'pct' });
  dashSingleAxisLineChart('c-own-semanal', { labels: D.labelsS, series: [{ label: me, color: DASH_C.ok, values: P.slaS }], unit:'pct' });
  function drawVol(view){
    var isM = view === 'mensal';
    setText('vol-period-label-1', isM ? 'por mês' : 'últimos 15 dias úteis');
    dashSingleAxisLineChart('c-own-diario', { labels: isM ? D.labelsM : P.volD.labels, series: [
      { label:'Tickets', color: DASH_C.royal, values: isM ? P.volM : P.volD.values, area:true }
    ], unit:'int', speed:0.75 });
  }
  drawVol('diario');
  bindToggle('vol-toggle', drawVol);
  setHTML('note-prestador', P.note);
  renderFora();
}

// Aba "Casos fora do SLA" — só aparece quando o build inclui D.prest.fora
function renderFora(){
  var F = D.prest.fora, tg = document.getElementById('tabs-toggle');
  if (!F) { if (tg) tg.parentNode.style.display = 'none'; return; }
  var geral = document.getElementById('tab-geral'), fora = document.getElementById('tab-fora');
  bindToggle('tabs-toggle', function(v){ if (geral) geral.hidden = v === 'fora'; if (fora) fora.hidden = v !== 'fora'; });
  setText('lbl-fora-total', '(' + F.rows.length + ')');
  setText('lbl-fora-periodo', F.periodo);
  var MOT = { A: 'Saiu com atraso', E: 'Ainda na etapa, prazo vencido', N: 'No-show depois das datas sugeridas', O: 'Outro' };
  var esc = function(t){ return String(t == null ? '' : t).replace(/[&<>"]/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var br = function(d){ return d ? d.slice(8, 10) + '/' + d.slice(5, 7) : '—'; };
  var st = { mes: 'T', mot: 'T', q: '' };
  setHTML('fora-mes-toggle', '<button type="button" class="active" data-view="T">Todos</button>' + F.meses.map(function(m){ return '<button type="button" data-view="' + m.key + '">' + esc(m.label) + '</button>'; }).join(''));
  function draw(){
    var q = st.q.toLowerCase();
    var base = F.rows.filter(function(r){ return (st.mes === 'T' || r.ent.slice(0, 7) === st.mes) && (!q || (r.id + ' ' + (r.cli || '') + ' ' + r.loc).toLowerCase().indexOf(q) >= 0); });
    var cnt = { A: 0, E: 0, N: 0, O: 0 }; base.forEach(function(r){ cnt[r.mot]++; });
    setHTML('fora-cards', '<div><b>' + base.length + '</b><span>casos fora do SLA</span></div><div><b>' + cnt.A + '</b><span>saíram da etapa com atraso</span></div><div><b>' + cnt.E + '</b><span>ainda na etapa, prazo vencido</span></div><div><b>' + (cnt.N + cnt.O) + '</b><span>no-show fora das datas' + (cnt.O ? ' e outros' : '') + '</span></div>');
    var rows = base.filter(function(r){ return st.mot === 'T' || r.mot === st.mot || (st.mot === 'N' && r.mot === 'O'); });
    setHTML('fora-tbody', rows.length ? rows.map(function(r){
      return '<tr><td><a href="' + F.link + r.id + '" target="_blank" rel="noopener">' + r.id + '</a></td><td>' + esc(r.cli || '—') + '</td><td>' + esc(r.pip) + '</td><td>' + esc(r.loc) + '</td><td>' + br(r.ent) + '</td><td>' + br(r.prazo) + '</td><td>' + br(r.sai) + '</td><td class="n">' + r.du + ' / ' + r.alvo + '</td><td><span class="mot mot-' + r.mot + '">' + MOT[r.mot] + '</span></td><td>' + esc(r.st) + '</td></tr>';
    }).join('') : '<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--ink-soft)">Nenhum caso com esses filtros.</td></tr>');
  }
  bindToggle('fora-mes-toggle', function(v){ st.mes = v; draw(); });
  bindToggle('fora-mot-toggle', function(v){ st.mot = v; draw(); });
  var busca = document.getElementById('fora-busca');
  if (busca) busca.addEventListener('input', function(){ st.q = busca.value || ''; draw(); });
  setHTML('note-fora', '<strong>Como ler:</strong> prazo = ' + F.regra + ' Dias úteis = gastos na etapa ÷ prazo (para quem ainda está na etapa, conta até ontem). Clique no número para abrir o ticket no HubSpot. Pela data em que o ticket entrou na sua etapa; atualizado com o painel.');
  draw();
}
