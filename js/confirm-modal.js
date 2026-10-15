/**
 * CONFIRM-MODAL.JS - Modal de confirmação global reutilizável
 * Uso: SENAI_showConfirm({ title, message, variant, confirmText, cancelText, onConfirm, onCancel })
 * variant: 'danger' (vermelho) | 'warning' (âmbar) | 'info' (azul)
 */

(function () {
  let modalInjected = false;
  let resolvePromise = null;
  let currentConfig = null;

  const ICONS = {
    danger: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
    warning: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
    info: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
  };

  const BADGE_CLASSES = {
    danger: 'modal-badge-icon red',
    warning: 'modal-badge-icon amber',
    info: 'modal-badge-icon blue'
  };

  function injectModal() {
    if (modalInjected) return;
    const html = `
<div id="modalConfirmGeneric" class="modal-backdrop" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="confirmTitle">
  <div class="modal-card modal-sm">
    <button type="button" class="modal-close" data-close-modal aria-label="Fechar">&times;</button>
    <div class="modal-header">
      <div id="confirmBadge" class="modal-badge-icon red">${ICONS.danger}</div>
      <h2 id="confirmTitle">Confirmar</h2>
      <p id="confirmMessage" class="modal-subtitle"></p>
    </div>
    <div class="modal-actions-row">
      <button type="button" class="btn-subtle" id="confirmCancel" data-close-modal>Cancelar</button>
      <button type="button" class="btn-red-primary" id="confirmOk"><span id="confirmOkText">Confirmar</span></button>
    </div>
  </div>
</div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    modalInjected = true;

    const modal = document.getElementById('modalConfirmGeneric');
    const btnOk = document.getElementById('confirmOk');
    const btnCancel = document.getElementById('confirmCancel');
    const closeBtn = modal.querySelector('.modal-close');

    function cleanup() {
      btnOk.onclick = null;
      btnCancel.onclick = null;
      closeBtn.onclick = null;
      modal.onclick = null;
      document.removeEventListener('keydown', onKeydown);
    }

    function close() {
      modal.classList.remove('modal-active');
      modal.setAttribute('aria-hidden', 'true');
      cleanup();
      if (resolvePromise) {
        resolvePromise(false);
        resolvePromise = null;
      }
    }

    function onKeydown(e) {
      if (e.key === 'Escape') close();
    }

    btnCancel.addEventListener('click', close);
    closeBtn.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    btnOk.addEventListener('click', () => {
      modal.classList.remove('modal-active');
      modal.setAttribute('aria-hidden', 'true');
      cleanup();
      if (resolvePromise) {
        resolvePromise(true);
        resolvePromise = null;
      }
      if (currentConfig?.onConfirm) currentConfig.onConfirm();
    });
  }

  function openModal() {
    const modal = document.getElementById('modalConfirmGeneric');
    modal.classList.add('modal-active');
    modal.setAttribute('aria-hidden', 'false');
    document.addEventListener('keydown', onKeydown);
    document.getElementById('confirmCancel').focus();
  }

  function onKeydown(e) {
    if (e.key === 'Escape') {
      const modal = document.getElementById('modalConfirmGeneric');
      if (modal.classList.contains('modal-active')) {
        const btnCancel = document.getElementById('confirmCancel');
        if (btnCancel) btnCancel.click();
      }
    }
  }

  window.SENAI_showConfirm = function (options = {}) {
    return new Promise((resolve) => {
      injectModal();
      resolvePromise = resolve;

      const {
        title = 'Confirmar',
        message = 'Deseja confirmar esta ação?',
        variant = 'danger',
        confirmText = 'Confirmar',
        cancelText = 'Cancelar',
        onConfirm = () => {},
        onCancel = () => {}
      } = options;

      currentConfig = { onConfirm, onCancel };

      const badge = document.getElementById('confirmBadge');
      const titleEl = document.getElementById('confirmTitle');
      const messageEl = document.getElementById('confirmMessage');
      const okText = document.getElementById('confirmOkText');
      const cancelBtn = document.getElementById('confirmCancel');

      badge.className = BADGE_CLASSES[variant] || BADGE_CLASSES.danger;
      badge.innerHTML = ICONS[variant] || ICONS.danger;
      titleEl.textContent = title;
      messageEl.textContent = message;
      okText.textContent = confirmText;
      cancelBtn.textContent = cancelText;

      openModal();
    });
  };

  window.SENAI_showConfirm.sync = function (options) {
    const result = { confirmed: false };
    const syncConfirm = (opts) => {
      const originalOnConfirm = opts.onConfirm;
      const originalOnCancel = opts.onCancel;
      return new Promise((resolve) => {
        opts.onConfirm = () => {
          result.confirmed = true;
          originalOnConfirm?.();
          resolve();
        };
        opts.onCancel = () => {
          result.confirmed = false;
          originalOnCancel?.();
          resolve();
        };
        window.SENAI_showConfirm(opts);
      });
    };
    return syncConfirm(options).then(() => result.confirmed);
  };
})();