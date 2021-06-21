import React, { useEffect } from "react";
import ReactGA from "react-ga";
import { useHistory } from "react-router-dom";

export const logPageView = (history) => {
  history.listen((location) => {
    const page = location.pathname || window.location.pathname;
    ReactGA.set({ page: page });
    ReactGA.pageview(page);
    console.log(`Page View logged for: ${page}`);
  });
};

export const withTracker = (WrappedComponent) => {
  return (props) => {
    const history = useHistory();

    useEffect(() => {
      logPageView(history);
    }, [history]);

    return <WrappedComponent {...props} />;
  };
};
