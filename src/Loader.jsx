import React, { useState } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { Box } from '@mui/material';

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
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'background.default', // Use theme background
        zIndex: 9999,
      }}
      role="status"
      aria-label="Loading"
    >
      <Box sx={{ width: 300, height: 300 }}>
        <DotLottieReact
          src={animationSrc}
          loop
          autoplay
        />
      </Box>
    </Box>
  );
};

export default Loader;
