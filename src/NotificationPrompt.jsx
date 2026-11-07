// @ts-nocheck
import React, { useEffect, useState } from "react";
import Icon from "./Icon";
import { useAuthState } from "./util";
import { recentBhajans } from "./engagement";
import {
  pushSupported,
  shouldOfferNotifications,
  enableNotifications,
  dismissNotificationPrompt,
} from "./notifications";

const Prompt = () => {
  const { user } = useAuthState();
  const uid = user?.uid;
  const [state, setState] = useState("idle"); // idle | busy | done | hidden

  if (state === "hidden") return null;
  if (state === "done") {
    return (
      <div className='notify-card' role='status'>
        <Icon name='bell' />
        <span>Notifications are on. We’ll only send the important ones.</span>
      </div>
    );
  }
  if (!shouldOfferNotifications({ uid, bhajansOpened: recentBhajans().length })) return null;

  const turnOn = async () => {
    setState("busy");
    try {
      setState((await enableNotifications(uid)) ? "done" : "hidden");
    } catch (error) {
      console.warn("Could not turn on notifications:", error);
      setState("hidden");
    }
  };

  return (
    <div className='notify-card'>
      <Icon name='bell' />
      <div className='notify-text'>
        <strong>Stay in tune</strong>
        <span>Get a note when new bhajans are added and before your subscription runs out.</span>
      </div>
      <div className='notify-actions'>
        <button type='button' className='notify-yes' onClick={turnOn} disabled={state === "busy"}>
          Turn on
        </button>
        <button
          type='button'
          className='notify-no'
          onClick={() => {
            dismissNotificationPrompt();
            setState("hidden");
          }}>
          Not now
        </button>
      </div>
    </div>
  );
};

/** A gentle, dismissible card offering push notifications to engaged subscribers. */
const NotificationPrompt = () => {
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    let cancelled = false;
    pushSupported().then((ok) => !cancelled && setSupported(ok));
    return () => {
      cancelled = true;
    };
  }, []);
  // Only browsers that can receive push subscribe to sign-in state.
  return supported ? <Prompt /> : null;
};

export default NotificationPrompt;
