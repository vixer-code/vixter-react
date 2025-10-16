import { useUser } from '../contexts/UserContext';

/**
 * Hook para verificar se o usuário atual é um administrador
 * @returns {boolean} true se o usuário é admin, false caso contrário
 */
export const useAdminStatus = () => {
  const { userProfile } = useUser();
  
  // Verifica se o usuário tem a flag admin = true
  return userProfile?.admin === true;
};

export default useAdminStatus;
