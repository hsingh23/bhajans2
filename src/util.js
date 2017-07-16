import React from 'react';
import { Route } from 'react-router-dom';

export const getNext = () => decodeURIComponent((window.location.hash.match(/next=(.*?)(&|$)/) || ['', '/'])[1]);
export const getJson = key => (localStorage[key] ? JSON.parse(localStorage[key]) : null);
export const setJson = (key, value) => (localStorage[key] = JSON.stringify(value));

export const PropsRoute = ({ component, ...rest }) => {
  return (
    <Route {...rest} render={routeProps => {
      return React.createElement(component, Object.assign({}, routeProps, rest))
    }} />
  );
}