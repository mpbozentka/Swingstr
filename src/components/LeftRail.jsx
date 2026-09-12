import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  MousePointer2,
  PenTool,
  Palette,
  Trash2,
  Gauge,
  Scissors,
  Check,
  X,
  Download,
  Save,
} from 'lucide-react';
import ToolMenu from './ToolMenu';
import StyleMenu from './StyleMenu';
import SpeedMenu from './SpeedMenu';

const DRAW_TOOLS = ['line', 'angle', 'circle', 'rect', 'free', 'blur', 'select'];

/**
 * Renders a rail flyout at the document root, pinned to its button.
 *
 * It can't just live inside the rail: the rail scrolls (overflow-y-auto),
 * and a scroll container clips its sides as well as its top and bottom, so a
 * menu poking out to the right is invisible. position:fixed doesn't escape
 * either — the rail is transform-centred, which makes it the containing block
 * for fixed children. A portal is the only way out.
 *
 * Events still bubble to the rail through React's tree, so the rail's
 * click-swallowing (which keeps a menu from closing itself) still applies.
 */
function RailFlyout({ anchorRef, children }) {
  const boxRef = useRef(null);
  // Off-screen for the first paint, then measured and placed in a layout
  // effect — so it never flashes in the wrong spot.
  const [pos, setPos] = useState({ left: -9999, top: -9999 });

  useLayoutEffect(() => {
    const place = () => {
      const anchor = anchorRef.current;
      const box = boxRef.current;
      if (!anchor || !box) return;
      const r = anchor.getBoundingClientRect();
      setPos({
        left: r.right + 8,
        // Keep tall menus (the tool grid) fully on screen near the bottom.
        top: Math.max(8, Math.min(r.top, window.innerHeight - box.offsetHeight - 8)),
      });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [anchorRef]);

  return createPortal(
    <div ref={boxRef} className="fixed z-50" style={{ left: pos.left, top: pos.top }}>
      {children}
    </div>,
    document.body,
  );
}

/**
 * One vertical strip floating over the left edge of the video, holding
 * everything that acts on the ACTIVE video: drawing, style, speed, trim, and
 * the two export paths. Frosted glass rather than a solid
 * panel so the footage keeps running underneath it. Flyout menus open to the
 * right of their own button, so the rail stays the only place these live.
 */

function RailButton({ active, className = '', children, ...rest }) {
  return (
    <button
      {...rest}
      aria-pressed={active}
      className={`w-11 h-9 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors border backdrop-blur-sm ${
        active
          ? 'bg-purple-500/80 text-white border-purple-300/40 shadow-lg shadow-purple-900/40'
          : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/15 hover:text-white'
      } disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-7 h-px bg-white/15 my-1 shrink-0" />;
}

export default function LeftRail({
  tool,
  setTool,
  color,
  setColor,
  lineWidth,
  setLineWidth,
  speed,
  changeSpeed,
  activeMenu,
  setActiveMenu,
  clearShapes,
  activeTrim,
  onSetTrim,
  onClearTrim,
  onExport,
  onSave,
}) {
  const toolsAnchorRef = useRef(null);
  const styleAnchorRef = useRef(null);
  const speedAnchorRef = useRef(null);

  const toggleMenu = (name) => setActiveMenu(activeMenu === name ? null : name);
  const trimSet = activeTrim.start != null || activeTrim.end != null;

  return (
    <aside
      className="absolute left-3 top-1/2 -translate-y-1/2 max-h-[calc(100%-1.5rem)] w-14 flex flex-col items-center gap-1 py-2 overflow-y-auto z-40 rounded-2xl bg-gray-900/45 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/50"
      onClick={(e) => e.stopPropagation()}
    >
      <RailButton
        onClick={() => setTool('move')}
        active={tool === 'move'}
        title="Move / pan"
        aria-label="Move or pan"
      >
        <MousePointer2 size={18} />
      </RailButton>

      <div ref={toolsAnchorRef}>
        <RailButton
          onClick={() => toggleMenu('tools')}
          active={DRAW_TOOLS.includes(tool) || activeMenu === 'tools'}
          title="Drawing tools"
          aria-label="Drawing tools"
        >
          <PenTool size={18} />
        </RailButton>
      </div>
      {activeMenu === 'tools' && (
        <RailFlyout anchorRef={toolsAnchorRef}>
          <ToolMenu tool={tool} setTool={setTool} onClose={() => setActiveMenu(null)} positionClass="" />
        </RailFlyout>
      )}

      <div ref={styleAnchorRef}>
        <RailButton
          onClick={() => toggleMenu('style')}
          active={activeMenu === 'style'}
          title="Stroke colour and thickness"
          aria-label="Stroke style"
        >
          <Palette size={18} style={{ color: activeMenu === 'style' ? undefined : color }} />
        </RailButton>
      </div>
      {activeMenu === 'style' && (
        <RailFlyout anchorRef={styleAnchorRef}>
          <StyleMenu
            color={color}
            setColor={setColor}
            lineWidth={lineWidth}
            setLineWidth={setLineWidth}
            positionClass=""
          />
        </RailFlyout>
      )}

      <RailButton
        onClick={clearShapes}
        title="Clear all drawings"
        aria-label="Clear all drawings"
        className="text-red-400 hover:bg-red-900/40 hover:text-red-300"
      >
        <Trash2 size={18} />
      </RailButton>

      <Divider />

      <div ref={speedAnchorRef}>
        <RailButton
          onClick={() => toggleMenu('speed')}
          active={activeMenu === 'speed' || speed !== 1}
          title="Playback speed"
          aria-label="Playback speed"
        >
          <Gauge size={16} />
          <span className="text-[9px] font-bold leading-none">{speed}x</span>
        </RailButton>
      </div>
      {activeMenu === 'speed' && (
        <RailFlyout anchorRef={speedAnchorRef}>
          <SpeedMenu
            speed={speed}
            changeSpeed={changeSpeed}
            onClose={() => setActiveMenu(null)}
            positionClass=""
          />
        </RailFlyout>
      )}

      <Divider />

      <RailButton
        onClick={() => onSetTrim('start')}
        active={activeTrim.start != null}
        title={activeTrim.start != null
          ? `Trim start: ${activeTrim.start.toFixed(2)}s — click to move here`
          : 'Set trim start at current frame'}
        aria-label="Set trim start"
      >
        <Scissors size={14} />
        <span className="text-[9px] font-bold leading-none flex items-center gap-0.5">
          In{activeTrim.start != null ? <Check size={8} /> : null}
        </span>
      </RailButton>

      <RailButton
        onClick={() => onSetTrim('end')}
        active={activeTrim.end != null}
        title={activeTrim.end != null
          ? `Trim end: ${activeTrim.end.toFixed(2)}s — click to move here`
          : 'Set trim end at current frame'}
        aria-label="Set trim end"
      >
        <Scissors size={14} className="rotate-180" />
        <span className="text-[9px] font-bold leading-none flex items-center gap-0.5">
          Out{activeTrim.end != null ? <Check size={8} /> : null}
        </span>
      </RailButton>

      {trimSet && (
        <RailButton
          onClick={onClearTrim}
          title="Clear trim"
          aria-label="Clear trim"
          className="text-gray-400 hover:bg-red-900/40 hover:text-red-300"
        >
          <X size={16} />
        </RailButton>
      )}

      <Divider />

      <RailButton
        onClick={onExport}
        title="Export swing sequence or video clip"
        aria-label="Export swing sequence or video clip"
      >
        <Download size={18} />
      </RailButton>

      <RailButton
        onClick={onSave}
        title="Save to student"
        aria-label="Save to student"
        className="text-purple-300 hover:text-purple-100"
      >
        <Save size={18} />
      </RailButton>
    </aside>
  );
}
