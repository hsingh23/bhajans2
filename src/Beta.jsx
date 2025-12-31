import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from './Header';
import { auth, db, checkRefOnce, goOnline, goOffline } from './firebase';
import { ref, set, get } from 'firebase/database';
import { getNext } from './util';
import { useNavigate, useLocation } from 'react-router-dom';

const Beta = () => {
  const [optedIn, setOptedIn] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const intervalRef = useRef(null);

  const [isBeta, setIsBeta] = useState(false);

  const checkBeta = useCallback(() => {
    if (auth.currentUser) {
      checkRefOnce(`/beta/${auth.currentUser.uid}`).then(isBetaUser => {
        if (isBetaUser) {
          setIsBeta(true);
        }
      });
    }
  }, []);

  useEffect(() => {
    if (isBeta) {
      localStorage.setItem('beta', '1');
      navigate(getNext());
    }
  }, [isBeta, navigate]);

  useEffect(() => {
    if (localStorage.getItem('beta') === '1') {
      navigate(getNext(), { replace: true });
      return;
    }

    intervalRef.current = setInterval(checkBeta, 2000);

    if (auth.currentUser) {
      checkRefOnce(`/confirmBeta/${auth.currentUser.uid}`).then(val => {
        if (val) {
          setOptedIn(true);
        }
      });
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [navigate, checkBeta]);

  const optIn = async () => {
    if (auth.currentUser) {
      goOnline();
      try {
        const snap = await get(ref(db, `/beta/${auth.currentUser.uid}`));
        if (!snap.exists()) {
          await set(ref(db, `/confirmBeta/${auth.currentUser.uid}`), {
            email: auth.currentUser.email,
            name: auth.currentUser.displayName,
            signupDate: +new Date()
          });
          setOptedIn(true);
        } else {
          setIsBeta(true);
        }
      } catch (err) {
        console.error(err);
      }
      goOffline();
    } else {
      navigate(`/login${location.search}`);
    }
  };

  return (
    <div className="App">
      <Header title="Sing with Amma Beta" />
      <div className="restPage">
        <p>
          Welcome to Amma&apos;s Bhajan Searcher, making bhajans easier. This is a beta website which means that things may not work as they should. Please help us
          make the website better. As a gift, you will have free access to this website until September 1st 2017.{' '}
        </p>
        <p>We may contact you via email, and push messages during the beta period to answer short surveys.</p>
        {optedIn
          ? <div className="bigRedText">
              <div>Thanks for requesting access to the beta program! This site will automatically redirect once you are approved.</div> While you wait, please
              support us by liking{' '}
              <a href="https://www.facebook.com/sing.withamma" target="_blank" rel="noopener noreferrer">
                our facebook page
              </a>{' '}
              and <strong>sharing it with others</strong> who may also make like this website..
            </div>
          : <button onClick={optIn}>Agree and Continue</button>}
      </div>
    </div>
  );
};

export default Beta;
