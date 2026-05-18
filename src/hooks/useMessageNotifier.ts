import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useMessageNotifier() {
  const originalTitle = useRef<string>(typeof document !== 'undefined' ? document.title : '');
  const intervalRef = useRef<number | null>(null);
  const unreadCount = useRef(0);

  useEffect(() => {
    originalTitle.current = document.title.replace(/^\(\d+\)\s*/, '') || 'Dani Locações';

    const stopFlash = () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      unreadCount.current = 0;
      document.title = originalTitle.current;
    };

    const startFlash = () => {
      if (intervalRef.current) return;
      let toggle = false;
      intervalRef.current = window.setInterval(() => {
        toggle = !toggle;
        document.title = toggle
          ? `🔔 (${unreadCount.current}) Nova mensagem!`
          : originalTitle.current;
      }, 1000);
    };

    const onFocus = () => stopFlash();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) stopFlash();
    });

    const channel = supabase
      .channel('msg-notifier')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: 'sender=eq.client' },
        () => {
          if (document.hidden || !document.hasFocus()) {
            unreadCount.current += 1;
            startFlash();
            try {
              const audio = new Audio(
                'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='
              );
              audio.volume = 0.3;
              audio.play().catch(() => {});
            } catch {}
          }
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('focus', onFocus);
      stopFlash();
      supabase.removeChannel(channel);
    };
  }, []);
}
