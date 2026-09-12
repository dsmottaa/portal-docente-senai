/* SIDEBAR.JS - Fonte única do menu lateral do Portal.
 * Substitui o HTML repetido nas 14 páginas.
 * A página atual é indicada por <body data-active="pagina.html">.
 */
(function () {
  'use strict';

  var I = {
    dashboard: '<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect>',
    turma: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><path d="M20 8v6"></path><path d="M23 11h-6"></path>',
    diario: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>',
    carometro: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>',
    ocorrencias: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
    materiais: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>',
    mapa: '<circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>',
    ia: '<rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8" y2="16.01"></line><line x1="16" y1="16" x2="16" y2="16.01"></line>',
    mural: '<path d="M4 4h16v12H5l-3 3V4z"></path><line x1="8" y1="9" x2="16" y2="9"></line><line x1="8" y1="13" x2="13" y2="13"></line>',
    calendario: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>',
    central: '<path d="M12 20s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>',
    relatorios: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line>',
    configuracao: '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>',
    instalacao: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>'
  };

  var MENU = [
    { secao: 'AULA', itens: [
      { pagina: 'dashboard.html', label: 'Central da Aula', icone: I.dashboard },
      { pagina: 'turma.html', label: 'Gestão da Turma', icone: I.turma },
      { pagina: 'diario.html', label: 'Diário de Classe', icone: I.diario },
      { pagina: 'carometro.html', label: 'Presença & Frequência', icone: I.carometro },
      { pagina: 'ocorrencias.html', label: 'Ocorrências', icone: I.ocorrencias }
    ] },
    { secao: 'RECURSOS', itens: [
      { pagina: 'materiais.html', label: 'Materiais', icone: I.materiais },
      { pagina: 'mapa.html', label: 'Reserva da Sala', icone: I.mapa },
      { pagina: 'ia.html', label: 'Assistente IA', icone: I.ia },
      { pagina: 'mural.html', label: 'Mural de Avisos', icone: I.mural },
      { pagina: 'calendario.html', label: 'Calendário', icone: I.calendario }
    ] },
    { secao: 'GESTÃO', itens: [
      { pagina: 'central.html', label: 'Central Coordenação', icone: I.central, id: 'navCentralCoord' },
      { pagina: 'relatorios.html', label: 'Relatórios', icone: I.relatorios },
      { pagina: 'configuracao.html', label: 'Configurações', icone: I.configuracao },
      { pagina: 'instalacao.html', label: 'Instalação', icone: I.instalacao }
    ] }
  ];

  function svg(guts) {
    return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">' + guts + '</svg>';
  }

  function montar() {
    var slot = document.getElementById('sidebarNav');
    if (!slot) return;
    var ativa = (document.body.getAttribute('data-active') || '').toLowerCase();
    var ul = document.createElement('ul');
    MENU.forEach(function (grupo) {
      var sec = document.createElement('li');
      sec.className = 'menu-section';
      sec.textContent = grupo.secao;
      ul.appendChild(sec);
      grupo.itens.forEach(function (item) {
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = item.pagina;
        if (item.pagina.toLowerCase() === ativa) a.className = 'nav-active';
        if (item.id) a.id = item.id;
        var icone = document.createElement('span');
        icone.className = 'menu-icon';
        icone.innerHTML = svg(item.icone);
        var texto = document.createElement('span');
        texto.className = 'menu-text';
        texto.textContent = item.label;
        a.appendChild(icone);
        a.appendChild(texto);
        li.appendChild(a);
        ul.appendChild(li);
      });
    });
    slot.appendChild(ul);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', montar);
  } else {
    montar();
  }
})();