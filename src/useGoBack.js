import { useLocation, useNavigate } from 'react-router-dom';

export const useGoBack = () => {
  const navigate = useNavigate();
  const { key, state } = useLocation();

  return () => {
    // "default" marks the page the app was opened on (shared link, installed
    // app): stepping back from it would leave the app instead of reaching search.
    // Pages that rewrite their own URL in place carry that fact as state.entryPoint.
    if (key === 'default' || state?.entryPoint) {
      navigate('/', { replace: true });
    } else {
      navigate(-1);
    }
  };
};
