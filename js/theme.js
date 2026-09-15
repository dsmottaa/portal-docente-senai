/**
 * THEME.JS - Modo escuro + cor de destaque personalizada (accent).
 * Carregado em todas as páginas. Gerenciador único de tema:
 *  - data-theme="dark|light" (modo escuro persistente)
 *  - variáveis --accent* definidas inline no <html> (cor do usuário)
 * Exposições globais:
 *  - SENAI_aplicarTemaCompleto()  aplica tema + cor + atualiza botões
 *  - SENAI_toggleTema()           alterna claro/escuro
 *  - SENAI_setCor(hex)            salva e aplica a cor do usuário
 *  - SENAI_CORES                  presets exibidos nas Configurações
 *  - SENAI_COR_ATUAL()            cor escolhida atualmente
 */
(function () {
  'use strict';

  var COR_PADRAO = '#E30613';

  var PRESETS = [
    { nome: 'SENAI', hex: '#E30613' },
    { nome: 'Azul', hex: '#2563EB' },
    { nome: 'Verde', hex: '#059669' },
    { nome: 'Roxo', hex: '#7C3AED' },
    { nome: 'Laranja', hex: '#EA580C' },
    { nome: 'Ciano', hex: '#0891B2' }
  ];

  function hexToRgb(hex) {
    var h = String(hex || '').replace('#', '').trim();
    if (!h) return null;
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length !== 6) return null;
    var n = parseInt(h, 16);
    if (isNaN(n)) return null;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function mix(hexA, hexB, pesoA) {
    var a = hexToRgb(hexA), b = hexToRgb(hexB);
    if (!a || !b) return hexA;
    var r = Math.round(a.r * pesoA + b.r * (1 - pesoA));
    var g = Math.round(a.g * pesoA + b.g * (1 - pesoA));
    var l = Math.round(a.b * pesoA + b.b * (1 - pesoA));
    return 'rgb(' + r + ',' + g + ',' + l + ')';
  }

  function rgbTripla(hex) {
    var c = hexToRgb(hex) || { r: 227, g: 6, b: 19 };
    return c.r + ', ' + c.g + ', ' + c.b;
  }

  function corEscolhida() {
    try {
      var c = localStorage.getItem('senai_cor');
      if (c && hexToRgb(c)) return c;
    } catch (e) {}
    return COR_PADRAO;
  }

  function temaAtual() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  window.SENAI_aplicarCor = function () {
    var base = corEscolhida();
    var escuro = temaAtual() === 'dark';
    var el = document.documentElement;
    el.style.setProperty('--accent', base);
    el.style.setProperty('--accent-rgb', rgbTripla(base));
    el.style.setProperty('--accent-hover', mix(base, '#FFFFFF', 0.82));
    el.style.setProperty('--accent-active', mix(base, '#1E1E1E', 0.78));
    el.style.setProperty('--accent-light', escuro ? mix(base, '#121212', 0.16) : mix(base, '#FFFFFF', 0.07));
    el.style.setProperty('--accent-pill', escuro ? mix(base, '#121212', 0.30) : mix(base, '#FFFFFF', 0.10));
  };

  window.SENAI_aplicarTema = function () {
    var pref = 'light';
    try { pref = localStorage.getItem('senai_tema') || 'light'; } catch (e) { pref = 'light'; }
    if (pref === 'light' && window.SENAI_loadConfig) {
      try {
        var cfg = SENAI_loadConfig();
        if (cfg.temaEscuro === true || cfg.temaEscuro === 'true') pref = 'dark';
      } catch (e) {}
    }
    document.documentElement.setAttribute('data-theme', pref === 'dark' ? 'dark' : 'light');
    return temaAtual();
  };

  window.SENAI_aplicarTemaCompleto = function () {
    window.SENAI_aplicarTema();
    window.SENAI_aplicarCor();
    atualizarBotoes();
  };

  window.SENAI_toggleTema = function () {
    var novo = temaAtual() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', novo);
    try { localStorage.setItem('senai_tema', novo); } catch (e) {}
    window.SENAI_aplicarCor();
    atualizarBotoes();
    return novo;
  };

  window.SENAI_setCor = function (hex) {
    if (!hexToRgb(hex)) return;
    try { localStorage.setItem('senai_cor', hex); } catch (e) {}
    window.SENAI_aplicarCor();
    atualizarBotoes();
  };

  window.SENAI_CORES = PRESETS;
  window.SENAI_COR_ATUAL = corEscolhida;

  function svgTema(escuro) {
    if (escuro) {
      return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
    }
    return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
  }

  function atualizarBotoes() {
    var e = temaAtual() === 'dark';
    document.querySelectorAll('[data-theme-btn]').forEach(function (btn) {
      btn.innerHTML = svgTema(!e) + '<span>' + (e ? 'Claro' : 'Escuro') + '</span>';
      btn.setAttribute('title', e ? 'Usar tema claro (Ctrl+Shift+D)' : 'Usar tema escuro (Ctrl+Shift+D)');
    });
    document.querySelectorAll('[data-theme-float]').forEach(function (btn) {
      btn.innerHTML = svgTema(!e);
      btn.setAttribute('aria-label', e ? 'Tema claro' : 'Tema escuro');
      btn.setAttribute('title', e ? 'Tema claro' : 'Tema escuro');
    });
  }

  function injetarBotoes() {
    if (!document.body) return;
    if (document.body.classList.contains('login-page')) {
      var f = document.createElement('button');
      f.type = 'button';
      f.setAttribute('data-theme-float', '');
      f.className = 'theme-float';
      f.addEventListener('click', function () { window.SENAI_toggleTema(); });
      document.body.appendChild(f);
    } else {
      var footer = document.querySelector('.sidebar-footer');
      if (footer) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('data-theme-btn', '');
        btn.className = 'btn-theme';
        btn.addEventListener('click', function () { window.SENAI_toggleTema(); });
        var logout = footer.querySelector('.btn-logout');
        if (logout) footer.insertBefore(btn, logout);
        else footer.appendChild(btn);
      }
    }
    atualizarBotoes();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      injetarBotoes();
    });
  } else {
    injetarBotoes();
  }

  window.SENAI_aplicarTemaCompleto();
})();