import React, { useEffect, useState } from 'react';
import { Route, useLocation, useNavigate, useParams, Navigate } from 'react-router-dom';
import { auth, db } from './firebase';

export const getNext = () => decodeURIComponent((window.location.hash.match(/next=(.*?)(&|$)/) || ['', '/'])[1]);
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

// v6-compatible PropsRoute: creates a Route whose element is the target component
export const PropsRoute = ({ component, path, ...rest }) => {
  const ComponentWithRouter = withRouterCompat(component);
  return <Route path={path} element={<ComponentWithRouter path={path} {...rest} />} />;
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
  if (initializing) return null; // or a spinner
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
        const snap = await db.ref(`admin/${user.uid}`).once('value');
        if (!cancelled) {
          setIsAdmin(!!snap.val());
          setChecking(false);
        }
      } catch (e) {
        if (!cancelled) setChecking(false);
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (initializing || checking) return null; // or a spinner
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search + location.hash);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (!isAdmin) {
    return <Navigate to='/' replace />;
  }
  return children;
};