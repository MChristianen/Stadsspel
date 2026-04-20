import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

type ToastType = 'info' | 'success' | 'warning' | 'error';

interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const COLORS: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: { bg: '#d4edda', border: '#28a745', icon: '✅' },
  error:   { bg: '#f8d7da', border: '#dc3545', icon: '❌' },
  warning: { bg: '#fff3cd', border: '#ffc107', icon: '⚠️' },
  info:    { bg: '#d1ecf1', border: '#17a2b8', icon: 'ℹ️' },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 4500) => {
    const id = ++nextId.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '16px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxWidth: '340px',
          width: 'calc(100vw - 32px)',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => {
          const c = COLORS[t.type];
          return (
            <div
              key={t.id}
              style={{
                background: c.bg,
                border: `2px solid ${c.border}`,
                borderRadius: '10px',
                padding: '12px 16px',
                fontSize: '0.92em',
                lineHeight: '1.45',
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
                pointerEvents: 'auto',
                animation: 'toast-in 0.2s ease',
              }}
            >
              <span style={{ fontSize: '1.1em', flexShrink: 0, marginTop: '1px' }}>{c.icon}</span>
              <span>{t.message}</span>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}
