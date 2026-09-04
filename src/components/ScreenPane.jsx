import React, { forwardRef } from 'react';
import VideoCanvas from './VideoCanvas';

/**
 * One half of the analyzer view: a VideoCanvas with the optional ACTIVE badge
 * overlay. Pulled out of AnalyzerView so the left and right halves don't
 * duplicate identical wrapper JSX. (#12)
 */
const ScreenPane = forwardRef(function ScreenPane(
  { layout, active, containerClassName = '', ...canvasProps },
  ref
) {
  const widthClass = layout === 'split' ? 'w-1/2' : 'w-full';
  const z = active ? 'z-10' : 'z-0';
  return (
    <div className={`h-full relative flex flex-col ${widthClass} ${z} ${containerClassName}`}>
      {active && (
        <div
          className="absolute top-3 right-3 bg-purple-600/80 backdrop-blur border border-purple-300/30 text-xs font-bold px-2 py-1 rounded-lg z-20 pointer-events-none"
          aria-hidden="true"
        >
          ACTIVE
        </div>
      )}
      <VideoCanvas ref={ref} {...canvasProps} isActive={active} />
    </div>
  );
});

export default ScreenPane;
