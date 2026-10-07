
(function(){
  var slot = document.getElementById('logo-slot');
  if (slot) slot.outerHTML = LOGO_SVG;
  if (D.role === 'agendamento') { renderAgendamento(); renderAtendimento(); }
  else if (D.role === 'prestador') renderPrestador();
  else if (D.role === 'equipe') renderEquipe();
  renderVisaoGeral();
})();
