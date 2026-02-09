import { Toaster } from 'sonner';

const ToastProvider = () => {
  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        duration: 3500,
        style: {
          background: 'rgba(15, 23, 42, 0.85)',
          color: 'white',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          backdropFilter: 'blur(16px)'
        }
      }}
    />
  );
};

export default ToastProvider;
