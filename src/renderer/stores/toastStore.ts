import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { generatePrefixedId } from '@renderer/utils/idGenerator';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  showToast: (toast: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
  clearAllToasts: () => void;
}

export const useToastStore = create<ToastState>()(
  devtools(
    set => ({
      toasts: [],

      showToast: toast => {
        const id = generatePrefixedId('toast');
        set(state => ({
          toasts: [...state.toasts, { ...toast, id }],
        }));
      },

      dismissToast: id => {
        set(state => ({
          toasts: state.toasts.filter(toast => toast.id !== id),
        }));
      },

      clearAllToasts: () => {
        set({ toasts: [] });
      },
    }),
    {
      name: 'toast-store',
    }
  )
);

// Convenience hook for showing toasts
export const useToast = () => {
  const { showToast, dismissToast } = useToastStore();

  return {
    success: (title: string, message?: string, duration?: number) =>
      showToast({ type: 'success', title, message, duration }),
    error: (title: string, message?: string, duration?: number) =>
      showToast({ type: 'error', title, message, duration }),
    warning: (title: string, message?: string, duration?: number) =>
      showToast({ type: 'warning', title, message, duration }),
    info: (title: string, message?: string, duration?: number) =>
      showToast({ type: 'info', title, message, duration }),
    dismiss: dismissToast,
  };
};
