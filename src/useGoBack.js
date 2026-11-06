import { useLocation, useNavigate } from 'react-router-dom';

export const useGoBack = () => {
  const navigate = useNavigate();
  const { key } = useLocation();

  return () => {
    // "default" marks the page the app was opened on (shared link, installed
    // app): stepping back from it would leave the app instead of reaching search.
    if (key === 'default') {
      navigate('/', { replace: true });
    } else {
      navigate(-1);
    }
  };
};
