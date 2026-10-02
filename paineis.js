var ORANGE="#FF8A00";function fmtDias(v){return null==v?"—":v.toFixed(1).replace(".",",")+"d"}function fmtPct1(v){
return null==v?"—":v.toFixed(1).replace(".",",")+"%"}function bindToggle(groupId,fn){var group=document.getElementById(groupId)
;group&&group.addEventListener("click",function(e){var btn=e.target.closest("button[data-view]")
;btn&&(Array.prototype.forEach.call(group.querySelectorAll("button"),function(b){b.classList.remove("active")}),btn.classList.add("active"),
fn(btn.getAttribute("data-view")))})}function showPending(wrapId,toggleId,html){var wrap=document.getElementById(wrapId)
;wrap&&(wrap.innerHTML='<div class="dash-card"><div class="pending-note">'+html+"</div></div>");var tg=document.getElementById(toggleId)
;tg&&(tg.style.display="none")}function setText(id,txt){var el=document.getElementById(id);el&&(el.textContent=txt)}function setHTML(id,html){
var el=document.getElementById(id);el&&(el.innerHTML=html)}function renderVisaoGeral(){var T=D.team,bars=[{label:"Qtd. tickets",color:DASH_C.mist,
values:T.ticketsM},{label:"Potencial (dispositivos)",color:DASH_C.royal,values:T.potM}],line={label:"Dias médios p/ agendar",color:DASH_C.ok,values:T.diasM}
;dashLegend("leg-agend-geral",bars.concat([line])),dashComboChart("c-agend-geral",{labels:D.labelsM,bars:bars,line:line,lineAxis:"value",lineFmt:function(v){
return fmtDias(v)}}),dashLegend("leg-recrel",[{label:"Realizado",color:DASH_C.ok},{label:"Recebido (meta p/ não gerar backlog)",color:ORANGE}]),
dashGoalBarChart("c-recrel",{labels:D.labelsM,values:T.realM,goals:T.recM,lineColor:ORANGE})}function renderAgendamento(){
var O=D.own,T=D.team,me=D.first+" (você)";if(setText("lbl-first-month",D.labelsM[0].replace("*","")),
document.getElementById("stat-backlog").textContent=dashFmtInt(O.backlog),renderMetaStrip(),O.hasData){function part(own,team,labels){
return labels.map(function(l,i){return l+" "+(team[i]?fmtPct1(100*own[i]/team[i]):"—")}).join(" · ")}function drawPotDias(view){
var isS="semanal"===view,labels=isS?D.labelsS:D.labelsM;dashLegend("leg-potreal",[{label:"Veículos agendados",color:DASH_C.royal},{
label:"Meta ("+D.metaSemanal+"/semana)",color:ORANGE}]),dashGoalBarChart("c-potreal",{labels:labels,values:isS?O.potS:O.potM,goals:isS?O.metaS:O.metaM,
barColor:DASH_C.royal,lineColor:ORANGE}),dashLegend("leg-dias",[{label:me,color:DASH_C.ok},{label:"Etapa (equipe)",color:ORANGE}]),
dashSingleAxisLineChart("c-dias",{labels:labels,series:[{label:me,color:DASH_C.ok,values:isS?O.diasS:O.diasM,area:!0,fmt:fmtDias},{label:"Etapa (equipe)",
color:ORANGE,values:isS?T.diasS:T.diasM,dashed:!0,fixed:!0,hideLabels:!0,fmt:fmtDias}],unit:"int",speed:.75})}dashLegend("leg-own",[{label:me+" — tickets",
color:DASH_C.royal},{label:"Etapa (equipe)",color:ORANGE}]),dashSingleAxisLineChart("c-own-mensal",{labels:D.labelsM,series:[{label:me,color:DASH_C.royal,
values:O.ticketsM,area:!0},{label:"Etapa (equipe)",color:ORANGE,values:T.ticketsM,dashed:!0,fixed:!0,hideLabels:!0}],unit:"int",speed:.75}),
dashSingleAxisLineChart("c-own-semanal",{labels:D.labelsS,series:[{label:me,color:DASH_C.royal,values:O.ticketsS,area:!0},{label:"Etapa (equipe)",color:ORANGE,
values:T.ticketsS,dashed:!0,fixed:!0,hideLabels:!0}],unit:"int",speed:.75
}),setHTML("note-part-m","<strong>Sua participação na equipe</strong> (tickets seus ÷ tickets da equipe) — "+part(O.ticketsM,T.ticketsM,D.labelsM)+"."),
setHTML("note-part-s","<strong>Sua participação na equipe</strong> — "+part(O.ticketsS,T.ticketsS,D.weekRanges)+"."),drawPotDias("semanal"),
bindToggle("potdias-toggle",drawPotDias),dashLegend("leg-recrel-own",[{label:"Realizado",color:DASH_C.ok},{label:"Recebido (meta p/ não gerar backlog)",
color:ORANGE}]),dashGoalBarChart("c-recrel-own",{labels:D.labelsM,values:O.realM,goals:O.recM,lineColor:ORANGE})
}else document.getElementById("own-wrap").hidden=!0,document.getElementById("own-empty").hidden=!1}function renderMetaStrip(){
var O=D.own,nS=O.potS.length,nM=O.potM.length;function card(lbl,v,meta){
var pct=meta?Math.round(100*v/meta):null,cls=null==pct?"mc-warn":pct>=100?"mc-ok":pct>=80?"mc-warn":"mc-bad"
;return'<div class="meta-card"><div class="mc-lbl">'+lbl+'</div><div class="mc-num">'+dashFmtInt(v)+" <small>/ "+dashFmtInt(meta)+'</small></div><span class="mc-pct '+cls+'">'+(null==pct?"—":pct+"% da meta")+"</span></div>"
}
setHTML("meta-strip",card("Última semana · "+D.weekRanges[nS-1].replace(/^S-1 /,""),O.potS[nS-1],O.metaS[nS-1])+card("Semana anterior · "+D.weekRanges[nS-2].replace(/^S-2 /,""),O.potS[nS-2],O.metaS[nS-2])+card("Mês atual · "+D.labelsM[nM-1].replace("*","")+" até "+D.corte,O.potM[nM-1],O.metaM[nM-1]))
}function renderPrestador(){var P=D.prest,me=D.first+" (você)";function drawVol(view){var isM="mensal"===view
;setText("vol-period-label-1",isM?"por mês":"últimos 15 dias úteis"),dashSingleAxisLineChart("c-own-diario",{labels:isM?D.labelsM:P.volD.labels,series:[{
label:"Tickets",color:DASH_C.royal,values:isM?P.volM:P.volD.values,area:!0}],unit:"int",speed:.75})}setText("lbl-first-month",D.labelsM[0].replace("*","")),
dashSingleAxisLineChart("c-own-mensal",{labels:D.labelsM,series:[{label:me,color:DASH_C.ok,values:P.slaM}],unit:"pct"}),
dashSingleAxisLineChart("c-own-semanal",{labels:D.labelsS,series:[{label:me,color:DASH_C.ok,values:P.slaS}],unit:"pct"}),drawVol("diario"),
bindToggle("vol-toggle",drawVol),setHTML("note-prestador",P.note)}function renderEquipe(){
var E=D.eq,T=D.team,CORES=[DASH_C.royal,DASH_C.ok,DASH_C.warn,DASH_C.danger,DASH_C.mist,DASH_C.inkSoft];function drawMeta(view){var isS="semanal"===view
;dashLegend("leg-eq-meta",[{label:"Veículos agendados (equipe)",color:DASH_C.royal},{label:"Meta da equipe",color:ORANGE}]),dashGoalBarChart("c-eq-meta",{
labels:isS?D.labelsS:D.labelsM,values:isS?T.potS:T.potM,goals:isS?E.metaS:E.metaM,barColor:DASH_C.royal,lineColor:ORANGE})}function drawPessoa(view){
var isW="semana"===view,P=E.pessoas;setText("lbl-pessoa-periodo",isW?D.weekRanges[D.weekRanges.length-1]:D.labelsM[D.labelsM.length-1]+" até "+E.corte)
;var vals=P.map(function(p){return isW?p.potS[p.potS.length-1]:p.potM[p.potM.length-1]}),goals=P.map(function(p){
return isW?p.metaS[p.metaS.length-1]:p.metaM[p.metaM.length-1]});dashLegend("leg-eq-pessoa",[{label:"Veículos agendados",color:DASH_C.royal},{
label:"Meta individual",color:ORANGE}]),dashGoalBarChart("c-eq-pessoa",{labels:P.map(function(p){return p.first}),values:vals,goals:goals,barColor:DASH_C.royal,
lineColor:ORANGE}),setHTML("note-eq-pessoa","<strong>Atingimento</strong> — "+P.map(function(p,i){
return p.first+" "+(goals[i]?Math.round(100*vals[i]/goals[i])+"%":"—")+" (meta "+dashFmtInt(goals[i])+")"}).join(" · ")+". Meta semanal: "+P.map(function(p){
return p.first+" "+p.metaSemanal}).join(", ")+". Meta mensal = semanal × dias úteis ÷ 5 (mês atual proporcional até "+E.corte+").")}function drawEvol(view){
var isS="semanal"===view,labels=isS?D.labelsS:D.labelsM,tk=E.pessoas.map(function(p,i){return{label:p.first,color:CORES[i%CORES.length],
values:isS?p.ticketsS:p.ticketsM}});dashLegend("leg-eq-tickets",tk),dashSingleAxisLineChart("c-eq-tickets",{labels:labels,series:tk,unit:"int",speed:.75})
;var di=E.pessoas.map(function(p,i){return{label:p.first,color:CORES[i%CORES.length],values:isS?p.diasS:p.diasM,fmt:fmtDias}});di.push({label:"Equipe",
color:ORANGE,values:isS?T.diasS:T.diasM,dashed:!0,fixed:!0,hideLabels:!0,fmt:fmtDias}),dashLegend("leg-eq-dias",di),dashSingleAxisLineChart("c-eq-dias",{
labels:labels,series:di,unit:"int",speed:.75})}setText("lbl-meta-equipe",dashFmtInt(E.metaSemanalEquipe)+" veículos"),drawMeta("semanal"),
bindToggle("eq-meta-toggle",drawMeta),drawPessoa("semana"),bindToggle("eq-pessoa-toggle",drawPessoa),drawEvol("mensal"),bindToggle("eq-evol-toggle",drawEvol),
setHTML("eq-backlog",E.pessoas.map(function(p){
return'<div class="stat-card"><div class="stat-num">'+dashFmtInt(p.backlog)+'</div><div class="stat-lbl">'+p.first+"</div></div>"}).join("")),
D.prest&&(setText("lbl-prest-nome",D.prest.first),dashSingleAxisLineChart("c-eq-sla-m",{labels:D.labelsM,series:[{label:D.prest.first,color:DASH_C.ok,
values:D.prest.slaM}],unit:"pct"}),dashSingleAxisLineChart("c-eq-sla-s",{labels:D.labelsS,series:[{label:D.prest.first,color:DASH_C.ok,values:D.prest.slaS}],
unit:"pct"}))}!function(){var slot=document.getElementById("logo-slot");slot&&(slot.outerHTML=LOGO_SVG),
"agendamento"===D.role?renderAgendamento():"prestador"===D.role?renderPrestador():"equipe"===D.role&&renderEquipe(),renderVisaoGeral()}();
