// ==================== render (lê só o objeto D acima — nenhum número fica solto no código) ====================
var ORANGE = '#FF8A00';
function fmtDias(v){ return v==null ? '—' : v.toFixed(1).replace('.', ',') + 'd'; }
function fmtPct1(v){ return v==null ? '—' : v.toFixed(1).replace('.', ',') + '%'; }
function bindToggle(groupId, fn){
  var group = document.getElementById(groupId);
  if(!group) return;
  group.addEventListener('click', function(e){
    var btn = e.target.closest('button[data-view]');
    if(!btn) return;
    Array.prototype.forEach.call(group.querySelectorAll('button'), function(b){ b.classList.remove('active'); });
    btn.classList.add('active');
    fn(btn.getAttribute('data-view'));
  });
}
function showPending(wrapId, toggleId, html){
  var wrap = document.getElementById(wrapId);
  if(wrap) wrap.innerHTML = '<div class="dash-card"><div class="pending-note">' + html + '</div></div>';
  var tg = document.getElementById(toggleId);
  if(tg) tg.style.display = 'none';
}
function setText(id, txt){ var el = document.getElementById(id); if(el) el.textContent = txt; }
function setHTML(id, html){ var el = document.getElementById(id); if(el) el.innerHTML = html; }

// Visão geral — equipe Ongoing SMB inteira (mesma nos 5 painéis)
function renderVisaoGeral(){
  var T = D.team;
  var bars = [
    { label:'Qtd. tickets', color: DASH_C.mist, values: T.ticketsM },
    { label:'Potencial (dispositivos)', color: DASH_C.royal, values: T.potM }
  ];
  var line = { label:'Dias médios p/ agendar', color: DASH_C.ok, values: T.diasM };
  dashLegend('leg-agend-geral', bars.concat([line]));
  dashComboChart('c-agend-geral', { labels: D.labelsM, bars: bars, line: line, lineAxis: 'value', lineFmt: function(v){ return fmtDias(v); } });
  var rr = [{ label:'Realizado', color: DASH_C.ok, values: T.realM }, { label:'Recebido', color: ORANGE, values: T.recM }];
  dashLegend('leg-recrel', rr);
  dashSingleAxisLineChart('c-recrel', { labels: D.labelsM, series: rr, unit:'int', speed:0.75 });
}

