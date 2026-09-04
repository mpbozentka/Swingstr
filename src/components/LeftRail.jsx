import React from 'react';
import {
  MousePointer2,
  PenTool,
  Palette,
  Trash2,
  Gauge,
  Scissors,
  Check,
  X,
  PersonStanding,
  Loader2,
  Download,
  Save,
} from 'lucide-react';
import ToolMenu from './ToolMenu';
import StyleMenu from './StyleMenu';
import SpeedMenu from './SpeedMenu';

const DRAW_TOOLS = ['line', 'angle', 'circle', 'rect', 'free', 'blur', 'select'];

/**
 * One vertical strip floating over the left edge of the video, holding
 * everything that acts on the ACTIVE video: drawing, style, speed, trim, the
 * pose/view tags, and the two export paths. Frosted glass rather than a solid
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
  activePose,
  poseBusy,
  onAnalyze,
  onCancelAnalysis,
  onToggleSkeleton,
  activeViewType,
  activeHandedness,
  onSetViewType,
  onToggleHandedness,
  onExport,
  onSave,
}) {
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

      <div className="relative">
        <RailButton
          onClick={() => toggleMenu('tools')}
          active={DRAW_TOOLS.includes(tool) || activeMenu === 'tools'}
          title="Drawing tools"
          aria-label="Drawing tools"
        >
          <PenTool size={18} />
        </RailButton>
        {activeMenu === 'tools' && (
          <ToolMenu
            tool={tool}
            setTool={setTool}
            onClose={() => setActiveMenu(null)}
            positionClass="absolute top-0 left-[calc(100%+8px)]"
          />
        )}
      </div>

      <div className="relative">
        <RailButton
          onClick={() => toggleMenu('style')}
          active={activeMenu === 'style'}
          title="Stroke colour and thickness"
          aria-label="Stroke style"
        >
          <Palette size={18} style={{ color: activeMenu === 'style' ? undefined : color }} />
        </RailButton>
        {activeMenu === 'style' && (
          <StyleMenu
            color={color}
            setColor={setColor}
            lineWidth={lineWidth}
            setLineWidth={setLineWidth}
            positionClass="absolute top-0 left-[calc(100%+8px)]"
          />
        )}
      </div>

      <RailButton
        onClick={clearShapes}
        title="Clear all drawings"
        aria-label="Clear all drawings"
        className="text-red-400 hover:bg-red-900/40 hover:text-red-300"
      >
        <Trash2 size={18} />
      </RailButton>

      <Divider />

      <div className="relative">
        <RailButton
          onClick={() => toggleMenu('speed')}
          active={activeMenu === 'speed' || speed !== 1}
          title="Playback speed"
          aria-label="Playback speed"
        >
          <Gauge size={16} />
          <span className="text-[9px] font-bold leading-none">{speed}x</span>
        </RailButton>
        {activeMenu === 'speed' && (
          <SpeedMenu
            speed={speed}
            changeSpeed={changeSpeed}
            onClose={() => setActiveMenu(null)}
            positionClass="absolute top-0 left-[calc(100%+8px)]"
          />
        )}
      </div>

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

      {activePose.status === 'analyzing' ? (
        <>
          <RailButton active title="Analyzing…" aria-label="Analyzing" disabled>
            <Loader2 size={16} className="animate-spin" />
            <span className="text-[9px] font-bold leading-none">
              {Math.round(activePose.progress * 100)}%
            </span>
          </RailButton>
          <RailButton
            onClick={onCancelAnalysis}
            title="Cancel analysis"
            aria-label="Cancel analysis"
            className="text-gray-400 hover:bg-red-900/40 hover:text-red-300"
          >
            <X size={16} />
          </RailButton>
        </>
      ) : (
        <RailButton
          onClick={activePose.status === 'done' ? onToggleSkeleton : onAnalyze}
          disabled={poseBusy}
          active={activePose.status === 'done' && activePose.showSkeleton}
          title={
            activePose.status === 'done'
              ? (activePose.showSkeleton ? 'Hide skeleton overlay' : 'Show skeleton overlay')
              : 'Analyze swing (pose skeleton)'
          }
          aria-label={activePose.status === 'done' ? 'Toggle skeleton overlay' : 'Analyze swing'}
        >
          <PersonStanding size={16} />
          <span className="text-[9px] font-bold leading-none">
            {activePose.status === 'done' ? 'Skel' : 'Anlz'}
          </span>
        </RailButton>
      )}

      <RailButton
        onClick={() => onSetViewType('dtl')}
        active={activeViewType === 'dtl'}
        title="Tag this pane as down-the-line view"
        aria-label="Tag as down-the-line view"
      >
        <span className="text-[11px] font-bold leading-none">DTL</span>
      </RailButton>

      <RailButton
        onClick={() => onSetViewType('face-on')}
        active={activeViewType === 'face-on'}
        title="Tag this pane as face-on view"
        aria-label="Tag as face-on view"
      >
        <span className="text-[11px] font-bold leading-none">FO</span>
      </RailButton>

      {activeViewType === 'face-on' && (
        <RailButton
          onClick={onToggleHandedness}
          title="Golfer handedness — sets which arm counts as the lead arm"
          aria-label="Toggle golfer handedness"
        >
          <span className="text-[11px] font-bold leading-none">{activeHandedness}</span>
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
