import React from 'react';

// Inline stroke icons (24×24, currentColor) so the app needs no icon library.
const PATHS = {
  heart: (
    <path d='M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.3 4.5 6.9 4.5c2.1 0 3.5 1.1 5.1 3 1.6-1.9 3-3 5.1-3 3.6 0 5.5 3.5 4.2 6.8-1.8 4.6-9.3 9.2-9.3 9.2z' />
  ),
  music: (
    <>
      <path d='M9 18V5l11-2v13' />
      <circle cx='6' cy='18' r='3' />
      <circle cx='17' cy='16' r='3' />
    </>
  ),
  'music-note': (
    <>
      <path d='M12 18V3.5c1.2 2.3 3.6 3.3 6 4' />
      <circle cx='8.5' cy='18' r='3.5' />
    </>
  ),
  play: <path d='M7 4.5v15a.8.8 0 0 0 1.2.7l12-7.5a.8.8 0 0 0 0-1.4l-12-7.5A.8.8 0 0 0 7 4.5z' />,
  stop: <rect x='5.5' y='5.5' width='13' height='13' rx='2' />,
  cart: (
    <>
      <circle cx='9' cy='20' r='1.5' />
      <circle cx='18' cy='20' r='1.5' />
      <path d='M2.5 3h2.6l2.4 12.2a1.5 1.5 0 0 0 1.5 1.3h8.7a1.5 1.5 0 0 0 1.5-1.2L21 7H6' />
    </>
  ),
  info: (
    <>
      <circle cx='12' cy='12' r='9.5' />
      <path d='M12 16.5v-5' />
      <path d='M12 7.6v.1' />
    </>
  ),
  book: (
    <>
      <path d='M2.5 4.5h6a3.5 3.5 0 0 1 3.5 3.5v12a2.6 2.6 0 0 0-2.6-2.6H2.5z' />
      <path d='M21.5 4.5h-6A3.5 3.5 0 0 0 12 8v12a2.6 2.6 0 0 1 2.6-2.6h6.9z' />
    </>
  ),
  'arrow-left': (
    <>
      <path d='M19 12H5' />
      <path d='M11 18l-6-6 6-6' />
    </>
  ),
  'chevron-down': <path d='M6 9l6 6 6-6' />,
  'chevron-up': <path d='M18 15l-6-6-6 6' />,
  sun: (
    <>
      <circle cx='12' cy='12' r='4' />
      <path d='M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4' />
    </>
  ),
  moon: <path d='M20.5 14.1A8.5 8.5 0 1 1 9.9 3.5a6.6 6.6 0 0 0 10.6 10.6z' />,
  monitor: (
    <>
      <rect x='2.5' y='3.5' width='19' height='13' rx='2' />
      <path d='M8 20.5h8M12 16.5v4' />
    </>
  ),
  filter: <path d='M3 4.5h18l-7 8.3v6l-4 2v-8z' />,
  close: <path d='M6 6l12 12M18 6L6 18' />,
  bell: (
    <>
      <path d='M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9' />
      <path d='M10.3 21a1.94 1.94 0 0 0 3.4 0' />
    </>
  ),
  flag: (
    <>
      <path d='M5 21V4' />
      <path d='M5 4h11l-1.5 4L16 12H5' />
    </>
  ),
};

const FILLED = new Set(['heart', 'play', 'stop']);

/**
 * @param {{
 *   name: string,
 *   size?: string | number,
 *   filled?: boolean,
 *   color?: string,
 *   className?: string,
 *   style?: import('react').CSSProperties,
 *   title?: string,
 * }} props
 */
const Icon = ({ name, size = '1em', filled, color, className, style, title }) => {
  const isFilled = filled ?? FILLED.has(name);
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      width={size}
      height={size}
      fill={isFilled ? 'currentColor' : 'none'}
      stroke='currentColor'
      strokeWidth={2}
      strokeLinecap='round'
      strokeLinejoin='round'
      className={['icon', `icon-${name}`, className].filter(Boolean).join(' ')}
      style={{ color, verticalAlign: '-0.125em', ...style }}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable='false'>
      {title && <title>{title}</title>}
      {PATHS[name]}
    </svg>
  );
};

export default Icon;
