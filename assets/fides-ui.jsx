(function () {
  'use strict';

  // ===== Estado global de toasts (fila) =====
  var toastListeners = [];
  var toastSeq = 0;

  function emitToast(toast) {
    toastListeners.forEach(function (fn) { fn(toast); });
  }

  function subscribeToasts(fn) {
    toastListeners.push(fn);
    return function () {
      toastListeners = toastListeners.filter(function (x) { return x !== fn; });
    };
  }

  function pushToast(message, kind, durationMs) {
    var id = ++toastSeq;
    emitToast({
      type: 'add',
      toast: {
        id: id,
        message: String(message || ''),
        kind: kind || 'info',
        duration: typeof durationMs === 'number' ? durationMs : 3000
      }
    });
    return id;
  }

  function dismissToast(id) {
    emitToast({ type: 'dismiss', id: id });
  }

  // API publica
  var toast = {
    success: function (msg, dur) { return pushToast(msg, 'success', dur); },
    error:   function (msg, dur) { return pushToast(msg, 'error', dur); },
    warn:    function (msg, dur) { return pushToast(msg, 'warn', dur); },
    info:    function (msg, dur) { return pushToast(msg, 'info', dur); },
    dismiss: dismissToast
  };

  // ===== Hook useToast =====
  function useToast() {
    return toast;
  }

  // ===== Componente ToastViewport =====
  function ToastViewport() {
    var ref0 = React.useState([]);
    var items = ref0[0]; var setItems = ref0[1];

    React.useEffect(function () {
      var unsub = subscribeToasts(function (evt) {
        if (evt.type === 'add') {
          setItems(function (prev) { return prev.concat([evt.toast]); });
          if (evt.toast.duration > 0) {
            setTimeout(function () {
              setItems(function (prev) {
                return prev.filter(function (t) { return t.id !== evt.toast.id; });
              });
            }, evt.toast.duration);
          }
        } else if (evt.type === 'dismiss') {
          setItems(function (prev) {
            return prev.filter(function (t) { return t.id !== evt.id; });
          });
        }
      });
      return unsub;
    }, []);

    function close(id) {
      setItems(function (prev) { return prev.filter(function (t) { return t.id !== id; }); });
    }

    if (items.length === 0) return null;

    return React.createElement(
      'div',
      { className: 'fui-toast-viewport', role: 'region', 'aria-live': 'polite' },
      items.map(function (t) {
        return React.createElement(
          'div',
          { key: t.id, className: 'fui-toast fui-toast-' + t.kind, role: 'status' },
          React.createElement('span', { className: 'fui-toast-msg' }, t.message),
          React.createElement(
            'button',
            {
              className: 'fui-toast-close',
              onPointerUp: function () { close(t.id); },
              'aria-label': 'Fechar'
            },
            '×'
          )
        );
      })
    );
  }

  // ===== Componente ConfirmDialog (controlado) =====
  // Props:
  //   open: bool
  //   title: string
  //   message: string | node
  //   confirmLabel: string (default 'Confirmar')
  //   cancelLabel: string (default 'Cancelar')
  //   destructive: bool (default false)
  //   onConfirm: () => void
  //   onCancel: () => void
  function ConfirmDialog(props) {
    var open = !!props.open;
    var destructive = !!props.destructive;
    var confirmLabel = props.confirmLabel || 'Confirmar';
    var cancelLabel = props.cancelLabel || 'Cancelar';

    React.useEffect(function () {
      if (!open) return;
      function onKey(e) {
        if (e.key === 'Escape' && props.onCancel) props.onCancel();
        if (e.key === 'Enter' && props.onConfirm) props.onConfirm();
      }
      document.addEventListener('keydown', onKey);
      return function () { document.removeEventListener('keydown', onKey); };
    }, [open, props.onCancel, props.onConfirm]);

    if (!open) return null;

    return React.createElement(
      'div',
      {
        className: 'fui-dialog-backdrop',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'fui-dialog-title',
        onPointerUp: function (e) {
          if (e.target === e.currentTarget && props.onCancel) props.onCancel();
        }
      },
      React.createElement(
        'div',
        { className: 'fui-dialog', onPointerUp: function (e) { e.stopPropagation(); } },
        React.createElement(
          'h3',
          { id: 'fui-dialog-title', className: 'fui-dialog-title' },
          props.title || 'Confirmar'
        ),
        props.message
          ? React.createElement('div', { className: 'fui-dialog-message' }, props.message)
          : null,
        React.createElement(
          'div',
          { className: 'fui-dialog-actions' },
          React.createElement(
            'button',
            {
              className: 'fui-btn fui-btn-ghost',
              type: 'button',
              onPointerUp: function () { if (props.onCancel) props.onCancel(); }
            },
            cancelLabel
          ),
          React.createElement(
            'button',
            {
              className: 'fui-btn ' + (destructive ? 'fui-btn-danger' : 'fui-btn-primary'),
              type: 'button',
              autoFocus: true,
              onPointerUp: function () { if (props.onConfirm) props.onConfirm(); }
            },
            confirmLabel
          )
        )
      )
    );
  }

  // ===== Hook useConfirm -- promise-based =====
  // Uso:
  //   var confirm = useConfirm();
  //   var ok = await confirm({ title: 'Excluir?', destructive: true });
  //   if (ok) { ... }
  function useConfirm() {
    var ref0 = React.useState(null);
    var state = ref0[0]; var setState = ref0[1];

    var ConfirmHost = React.useMemo(function () {
      return function ConfirmHostImpl() {
        if (!state) return null;
        return React.createElement(ConfirmDialog, {
          open: true,
          title: state.title,
          message: state.message,
          confirmLabel: state.confirmLabel,
          cancelLabel: state.cancelLabel,
          destructive: state.destructive,
          onConfirm: function () {
            var s = state;
            setState(null);
            if (s.resolve) s.resolve(true);
          },
          onCancel: function () {
            var s = state;
            setState(null);
            if (s.resolve) s.resolve(false);
          }
        });
      };
    }, [state]);

    var confirm = React.useCallback(function (opts) {
      return new Promise(function (resolve) {
        setState({
          title: (opts && opts.title) || 'Confirmar',
          message: opts && opts.message,
          confirmLabel: opts && opts.confirmLabel,
          cancelLabel: opts && opts.cancelLabel,
          destructive: !!(opts && opts.destructive),
          resolve: resolve
        });
      });
    }, []);

    return { confirm: confirm, ConfirmHost: ConfirmHost };
  }

  // ===== Hook useModalClose =====
  // Uso:
  //   var mc = useModalClose(open, onClose);
  //   if (!mc.rendered) return null;
  //   // aplicar mc.closing como classe 'is-closing' nos elementos do modal
  //   // substituir chamadas de fechar por mc.requestClose()
  var CLOSE_MS = 180;

  function useModalClose(open, onClose) {
    var ref0 = React.useState(!!open);
    var rendered = ref0[0]; var setRendered = ref0[1];

    var ref1 = React.useState(false);
    var closing = ref1[0]; var setClosing = ref1[1];

    var timerRef = React.useRef(null);

    var requestClose = React.useCallback(function () {
      var prefersReduced = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (prefersReduced) {
        // Sem animação — desmontar e chamar onClose imediatamente
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        setClosing(false);
        setRendered(false);
        if (onClose) onClose();
      } else {
        // Janela de animação de saída
        setClosing(true);
        timerRef.current = setTimeout(function () {
          timerRef.current = null;
          setClosing(false);
          setRendered(false);
          if (onClose) onClose();
        }, CLOSE_MS);
      }
    }, [onClose]);

    React.useEffect(function () {
      if (open) {
        // Re-open: cancelar closing em andamento e remontar limpo
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        setClosing(false);
        setRendered(true);
      }
      // Quando open vira false: não desmontar direto;
      // o fechamento é orquestrado por requestClose() chamado pelo botão de fechar.
      return function () {
        clearTimeout(timerRef.current);
      };
    }, [open]);

    return { rendered: rendered, closing: closing, requestClose: requestClose };
  }

  // ===== Expor no window =====
  window.FidesUI = {
    ToastViewport: ToastViewport,
    ConfirmDialog: ConfirmDialog,
    useToast: useToast,
    useConfirm: useConfirm,
    useModalClose: useModalClose,
    toast: toast
  };
})();
