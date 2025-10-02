import { useState, useEffect } from 'react';

/**
 * Hook para detectar quando uma nova versão da aplicação está disponível
 * Compara o hash do arquivo principal atual com uma versão armazenada no localStorage
 */
export const useVersionCheck = () => {
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        // Obter a versão atual armazenada no localStorage
        const currentVersion = localStorage.getItem('app-version');
        
        // Tentar obter informações da página atual
        const response = await fetch(window.location.href + '?v=' + Date.now(), {
          method: 'HEAD',
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
        
        // Usar o timestamp de modificação do arquivo como versão
        const lastModified = response.headers.get('last-modified');
        const etag = response.headers.get('etag');
        
        // Criar uma versão única baseada em múltiplos fatores
        const newVersion = lastModified 
          ? new Date(lastModified).getTime().toString()
          : etag 
            ? etag.replace(/"/g, '')
            : Date.now().toString();
        
        // Se não há versão armazenada, armazenar a atual
        if (!currentVersion) {
          localStorage.setItem('app-version', newVersion);
          setIsChecking(false);
          return;
        }
        
        // Se a versão mudou, há uma atualização disponível
        if (currentVersion !== newVersion) {
          console.log('Nova versão detectada:', { currentVersion, newVersion });
          setIsUpdateAvailable(true);
        }
        
        setIsChecking(false);
      } catch (error) {
        console.warn('Erro ao verificar atualizações:', error);
        // Em caso de erro, usar timestamp atual como fallback
        const fallbackVersion = Date.now().toString();
        const currentVersion = localStorage.getItem('app-version');
        
        if (!currentVersion) {
          localStorage.setItem('app-version', fallbackVersion);
        }
        
        setIsChecking(false);
      }
    };

    // Verificar atualizações imediatamente
    checkForUpdates();

    // Verificar atualizações periodicamente (a cada 5 minutos)
    const interval = setInterval(checkForUpdates, 5 * 60 * 1000);

    // Verificar atualizações quando a página ganha foco
    const handleFocus = () => {
      checkForUpdates();
    };

    // Verificar atualizações quando a aplicação volta do background (mobile)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkForUpdates();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const updateApp = () => {
    // Limpar cache e recarregar a página
    localStorage.removeItem('app-version');
    
    // Limpar cache do service worker se disponível
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    }
    
    // Forçar reload sem cache
    window.location.reload(true);
  };

  const dismissUpdate = () => {
    setIsUpdateAvailable(false);
  };

  return {
    isUpdateAvailable,
    isChecking,
    updateApp,
    dismissUpdate
  };
};
