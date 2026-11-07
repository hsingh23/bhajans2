
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { getJson, setJson } from "./util";
import {
  setRefOnce,
  removeRefOnce,
  checkRefOnce,
  auth,
} from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { RequireAuth } from "./util";
import Search from "./Search";
import Profile from "./Profile";
import RenderPage from "./RenderPage";
import Icon from "./Icon";
import { setUserState, track } from "./analytics";
import { refreshNotificationToken } from "./notifications";
import Pay from "./Pay";
import Footer from "./Footer";

const getShow2025Param = (search) => {
  const value = new URLSearchParams(search).get("2025");
  if (value === "1") return true;
  if (value === "0") return false;
  return null;
};

const shouldShow2025 = () => true;

const App = () => {
  const [favorites, setFavorites] = useState(() => getJson("favorites") || {});
  const [allBhajans, setAllBhajans] = useState([]);
  const [show2025, setShow2025] = useState(shouldShow2025);
  const location = useLocation();

  useEffect(() => {
    setJson("favorites", favorites);
  }, [favorites]);

  useEffect(() => {
    const handleUser = async (user) => {
      if (!user) return;
      const remoteFavorites = await checkRefOnce(`favorites/${user.uid}`);
      setFavorites((prev) => {
        // Treat null remote favorites as empty object to prevent downstream errors
        // Note: This simple merge doesn't fully solve distributed deletions (requires tombstones),
        // but it ensures we have a valid object and picks up remote additions/updates.
        const merged = Object.assign({}, prev, remoteFavorites || {});
        setJson("favorites", merged);
        return merged;
      });
    };

    window
      .fetch("/bhajan-index2.json")
      .then((data) => data.json())
      .then((fetchedBhajans) => {
        const sorted = [...fetchedBhajans].sort((a, b) => (a.n < b.n ? -1 : a.n > b.n ? 1 : 0));
        window.fetchedBhajans = sorted;
        setAllBhajans(sorted);
      });

    // Subscribe to auth state changes to sync favorites on every login
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // GA4 splits signed-in and signed-out visitors on this; the subscription
      // part is refreshed again once syncUserData has read paid/{uid}.
      setUserState({ uid: user?.uid, expiresOn: user ? localStorage.expiresOn : undefined });
      if (user) {
        handleUser(user);
        refreshNotificationToken(user.uid);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const paramValue = getShow2025Param(location.search);
    if (paramValue === null) return;
    localStorage.setItem("show2025", paramValue ? "1" : "0");
    // Use setTimeout to avoid cascading render lint error
    setTimeout(() => setShow2025(paramValue), 0);
  }, [location.search]);

  const bhajans = useMemo(() => {
    if (show2025) {
      return allBhajans;
    }

    return allBhajans
      .map((bhajan) => {
        if (!bhajan?.l?.length) return bhajan;
        const filteredLocations = bhajan.l.filter((loc) => !loc.startsWith("2025-"));
        if (filteredLocations.length === 0) {
          return null;
        }
        if (filteredLocations.length === bhajan.l.length) {
          return bhajan;
        }
        return { ...bhajan, l: filteredLocations };
      })
      .filter(Boolean);
  }, [allBhajans, show2025]);

  const addFavorite = useCallback((name) => {
    track("add_to_favorites", { bhajan_name: name });
    setFavorites((prev) => {
      const updated = Object.assign({ [name]: 1 }, prev);
      const uid = auth?.currentUser?.uid;
      uid && setRefOnce(`favorites/${uid}/${name}`, "1");
      return updated;
    });
  }, []);

  const removeFavorite = useCallback((name) => {
    track("remove_from_favorites", { bhajan_name: name });
    setFavorites((prev) => {
      const updated = { ...prev };
      delete updated[name];
      const uid = auth?.currentUser?.uid;
      uid && removeRefOnce(`favorites/${uid}/${name}`);
      return updated;
    });
  }, []);

  const renderFavorite = useCallback((name, activeClassName, inactiveClassName) => {
    return favorites[name] ? (
      <button
        className={`${activeClassName || "button button-3d button-circle button-jumbo"} favorite-button is-favorite`}
        onClick={() => removeFavorite(name)}
        aria-label='unlike'
        aria-pressed='true'
        type='button'>
        <Icon name='heart' />
      </button>
    ) : (
      <button
        className={`${inactiveClassName || "button button-3d button-circle button-jumbo"} favorite-button`}
        onClick={() => addFavorite(name)}
        aria-label='like'
        aria-pressed='false'
        type='button'>
        <Icon name='heart' filled={false} />
      </button>
    );
  }, [favorites, addFavorite, removeFavorite]);

  const propsData = useMemo(() => ({
    favorites,
    bhajans,
    addFavorite,
    removeFavorite,
    renderFavorite,
  }), [favorites, bhajans, addFavorite, removeFavorite, renderFavorite]);

  return (
    <>
      <Routes>
        <Route path='/' element={<Search path='/' {...propsData} />} />
        <Route path='/pay' element={<Pay />} />
        <Route path='/profile' element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path='/my-favorites' element={<Search path='/my-favorites' {...propsData} />} />
        <Route
          path='/pdf/:location/:id/:name'
          element={<RequireAuth><RenderPage key={location.pathname} {...propsData} /></RequireAuth>}
        />
        <Route path='*' element={<Navigate to='/' />} />
      </Routes>
      <Footer />
    </>
  );
};

export default App;
