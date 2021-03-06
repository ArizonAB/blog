// @flow
import * as React from 'react';
import throttle from 'lodash.throttle';

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;

function easeInExpo(x: number): number {
  return x === 0 ? 0 : Math.pow(2, 10 * x - 10);
}

type IProgress = {
  contentHeight: number,
};

export const Progress = ({contentHeight}: IProgress) => {
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    const handleScroll = throttle(() => {
      const percentComplete = (window.scrollY / contentHeight) * 100;

      setProgress(clamp(+percentComplete.toFixed(2), -2, 104));
    }, 20);

    if (contentHeight) {
      window.addEventListener('scroll', handleScroll);
      window.addEventListener('resize', handleScroll);
      return () => {
        window.removeEventListener('scroll', handleScroll);
        window.removeEventListener('resize', handleScroll);
      };
    }
  }, [contentHeight]);

  const opacity = 1 - easeInExpo(progress / 100);

  return (
    <div tabIndex={-1} className="relative outline-none select-none">
      <div
        aria-hidden="true"
        className="relative flex flex-col bg-gray-400 overflow-hidden"
        style={{
          height: 'calc(88vh - 40px)',
          maxHeight: '425px',
          width: '1px',
          opacity,
        }}>
        <div
          className="absolute h-full bg-gray-800 left-0"
          style={{
            transform: `translateY(${progress}%)`,
            top: '-100%',
            width: '1px',
            opacity,
          }}
        />
      </div>
    </div>
  );
};
