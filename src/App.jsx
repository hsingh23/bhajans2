
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { getJson, setJson } from "./util";
import {
  setRefOnce,
  removeRefOnce,
  checkRefOnce,
  auth,
} from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { omit, get, orderBy } from "lodash-es";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { RequireAuth } from "./util";
import Search from "./Search";
import Profile from "./Profile";
import RenderPage from "./RenderPage";
import { library } from "@fortawesome/fontawesome-svg-core";
import {
  faHeart,
  faMusic,
  faPlay,
  faStop,
  faCompactDisc,
  faCartArrowDown,
  faInfo,
  faSearch,
  faArrowLeft,
  faBookOpen,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Pay from "./Pay";
import Footer from "./Footer";

library.add(
  faHeart,
  faMusic,
  faPlay,
  faStop,
  faCompactDisc,
  faCartArrowDown,
  faInfo,
  faBookOpen,
  faSearch,
  faArrowLeft
);

const getShow2025Param = (search) => {
  const value = new URLSearchParams(search).get("2025");
  if (value === "1") return true;
  if (value === "0") return false;
  return null;
};

const shouldShow2025 = () => localStorage.getItem("show2025") === "1";

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
        const sorted = orderBy(fetchedBhajans, ["n", "t"], ["asc", "asc"]);
        window.fetchedBhajans = sorted;
        setAllBhajans(sorted);
      });

    // Subscribe to auth state changes to sync favorites on every login
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        handleUser(user);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const paramValue = getShow2025Param(location.search);
    if (paramValue === null) return;
    localStorage.setItem("show2025", paramValue ? "1" : "0");
    setShow2025(paramValue);
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
    setFavorites((prev) => {
      const updated = Object.assign({ [name]: 1 }, prev);
      const uid = get(auth, "currentUser.uid");
      uid && setRefOnce(`favorites/${uid}/${name}`, "1");
      return updated;
    });
  }, []);

  const removeFavorite = useCallback((name) => {
    setFavorites((prev) => {
      const updated = omit(prev, name);
      const uid = get(auth, "currentUser.uid");
      uid && removeRefOnce(`favorites/${uid}/${name}`);
      return updated;
    });
  }, []);

  const renderFavorite = useCallback((name, activeClassName, inactiveClassName) => {
    return favorites[name] ? (
      <button
        className={
          activeClassName ||
          "button button-3d button-circle button-jumbo button-favorite-active"
        }
        onClick={() => removeFavorite(name)}
        aria-label='unlike'
        role='presentation'
        tabIndex={-1}>
        <FontAwesomeIcon icon='heart' style={{ color: '#f44336' }} />
      </button>
    ) : (
      <button
        className={
          inactiveClassName || "button button-3d button-circle button-jumbo"
        }
        onClick={() => addFavorite(name)}
        aria-label='like'
        role='presentation'
        tabIndex={-1}>
        <FontAwesomeIcon icon='heart' style={{ color: 'grey' }} />
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
