import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import React from 'react';

vi.mock('@lottiefiles/dotlottie-react', () => ({
  DotLottieReact: () => React.createElement('div', { 'data-testid': 'lottie-animation' }),
}));
