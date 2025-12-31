import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, Navigate } from 'react-router-dom';
import { auth, db } from './firebase';
import { ref, get } from 'firebase/database';
import Loader from './Loader';

// const LoadingScreen = () => (
//   <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
//     <CircularProgress />
//   </Box>
// );

export const getNext = () => {
  const params = new URLSearchParams(window.location.search);
  const next = params.get('next');
  if (next) return decodeURIComponent(next);
  
  // Fallback for hash-based next param if still used being set manually
  const hashMatch = window.location.hash.match(/next=(.*?)(&|$)/);
  return hashMatch ? decodeURIComponent(hashMatch[1]) : '/';
};
export const getJson = key => (localStorage[key] ? JSON.parse(localStorage[key]) : null);
export const setJson = (key, value) => (localStorage[key] = JSON.stringify(value));

// HOC to provide v5-like props (match, history, location) to class components
export const withRouterCompat = (Wrapped) => {
  const ComponentWithRouter = (props) => {
    const params = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const match = { params };
    const history = {
      // Defer navigation to avoid calling navigate during render/constructor
      push: (to) => Promise.resolve().then(() => navigate(to)),
      replace: (to) => Promise.resolve().then(() => navigate(to, { replace: true })),
      goBack: () => navigate(-1),
      length: window.history.length,
    };
    return (
      <Wrapped
        {...props}
        match={match}
        history={history}
        location={location}
      />
    );
  };
  return ComponentWithRouter;
};

// Hook: auth state (with initialization guard)
const useAuthState = () => {
  const [user, setUser] = useState(auth.currentUser || null);
  const [initializing, setInitializing] = useState(true);
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      setUser(u || null);
      setInitializing(false);
    });
    return () => unsub();
  }, []);
  return { user, initializing };
};

// RequireAuth: redirects to /login if not signed in
export const RequireAuth = ({ children }) => {
  const { user, initializing } = useAuthState();
  const location = useLocation();
  if (initializing) return <Loader />;
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search + location.hash);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return children;
};

// RequireAdmin: requires signed-in user AND admin flag in RTDB
export const RequireAdmin = ({ children }) => {
  const { user, initializing } = useAuthState();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!user) {
        setChecking(false);
        return;
      }
      try {
        const snap = await get(ref(db, `admin/${user.uid}`));
        if (!cancelled) {
          setIsAdmin(!!snap.val());
          setChecking(false);
        }
      } catch {
        if (!cancelled) setChecking(false);
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (initializing || checking) return <Loader />;
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search + location.hash);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (!isAdmin) {
    return <Navigate to='/' replace />;
  }
  return children;
};