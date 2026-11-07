import React, { lazy, Suspense, useState } from 'react';

const DotLottieReact = lazy(() =>
  import('@lottiefiles/dotlottie-react').then((m) => ({ default: m.DotLottieReact }))
);

const ANIMATIONS = [
  '/Audio playing animation.lottie',
  '/Sandy Loading.lottie',
  '/Siri Style Loading.lottie',
];

const Loader = () => {
  const [animationSrc] = useState(() => {
    const randomIndex = Math.floor(Math.random() * ANIMATIONS.length);
    return ANIMATIONS[randomIndex];
  });

  return (
    <div className='app-loader' role="status" aria-label="Loading">
      <div className='app-loader-animation'>
        <Suspense fallback={null}>
          <DotLottieReact src={animationSrc} loop autoplay />
        </Suspense>
      </div>
    </div>
  );
};

export default Loader;
