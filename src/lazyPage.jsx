// @ts-nocheck
import React, { lazy, Suspense } from "react";

// MUI (and its theme) only loads with the pages that use it, keeping it off
// the bhajan list's first load.
const MuiTheme = lazy(() => import("./MUIThemeProvider"));

const PageFallback = () => <div className='page-loading' aria-busy='true' />;

/** Code-splits a route. Pass { mui: true } for pages built with MUI components. */
export const lazyPage = (load, { mui = false } = {}) => {
  const Page = lazy(load);
  const LazyPage = (props) => (
    <Suspense fallback={<PageFallback />}>
      {mui ? (
        <MuiTheme>
          <Page {...props} />
        </MuiTheme>
      ) : (
        <Page {...props} />
      )}
    </Suspense>
  );
  return LazyPage;
};
