import React from 'react';
import {
  Download,
  Play,
  Pause,
  Trash2,
  MousePointer2,
  ChevronRight,
  ChevronLeft,
  ZoomIn,
  ZoomOut,
  SplitSquareHorizontal,
  Link as LinkIcon,
  Link2Off,
  Maximize,
  Camera,
  Users,
  Save,
  Palette,
  PenTool,
  Gauge,
  Crosshair,
  Check,
  X,
  LayoutGrid,
  Scissors,
  PersonStanding,
  Loader2,
} from 'lucide-react';
import { Button, IconButton, MenuButton } from './ui/Button';
import ScreenPane from './ScreenPane';
import ToolMenu from './ToolMenu';
import StyleMenu from './StyleMenu';
import SpeedMenu from './SpeedMenu';
import SaveModal from './SaveModal';
import MarkerBar from './MarkerBar';
import ExportModal from './ExportModal';
import GoogleAuthButton from './GoogleAuthButton';
import DrivePickerModal from './DrivePickerModal';
import SwingGraphPanel from './SwingGraphPanel';

export default function AnalyzerView({
  onOpenLibrary,
  layout,
  setLayout,
  sync,
  setSync,
  activeScreen,
  setActiveScreen,
  zooms,
  adjustZoom,
  leftRef,
  rightRef,
  leftVideo,
  rightVideo,
  onUpload,
  onUrlUpload,
  onClearVideo,
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
  isPlaying,
  togglePlay,
  seek,
  clearShapes,
  onSnapshot,
  openSaveModal,
  globalTime,
  globalDuration,
  onGlobalScrub,
  onGraphSeek,
  onTimeUpdate,
  onLinkedScrub,
  showSequenceModal,
  setShowSequenceModal,
  markers,
  trims,
  activeTrim,
  onSetTrim,
  onClearTrim,
  poseState,
  activePose,
  poseBusy,
  onAnalyze,
  onCancelAnalysis,
  onToggleSkeleton,
  viewTypes,
  handedness,
  activeViewType,
  activeHandedness,
  onSetViewType,
  onToggleHandedness,
  syncPoints,
  hasSyncOffset,
  syncOffset = 0,
  onSetSyncPoint,
  onClearSyncPoint,
  activeMarkers,
  onSetMarker,
  onRemoveMarker,
  onJumpToMarker,
  onPrevMarker,
  onNextMarker,
  students,
  showSaveModal,
  setShowSaveModal,
  saveData,
  setSaveData,
  saveToStudent,
  isSignedIn,
  userEmail,
  accessToken,
  onSignIn,
  onSignOut,
  onDriveLoad,
}) {
  const [drivePickerSide, setDrivePickerSide] = React.useState(null);
  return (
    <div
      className="h-screen w-screen bg-gray-900 text-gray-100 flex flex-col font-sans relative"
      onClick={() => setActiveMenu(null)}
    >
      <DrivePickerModal
        open={!!drivePickerSide}
        accessToken={accessToken}
        onLoadVideo={(side, blob, fileId, fileName) => {
          onDriveLoad(side, blob, fileId, fileName);
          setDrivePickerSide(null);
        }}
        onClose={() => setDrivePickerSide(null)}
      />

      <SaveModal
        show={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        students={students}
        saveData={saveData}
        setSaveData={setSaveData}
        onSave={saveToStudent}
      />

      <ExportModal
        show={showSequenceModal}
        onClose={() => setShowSequenceModal(false)}
        leftRef={leftRef}
        rightRef={rightRef}
        leftVideo={leftVideo}
        rightVideo={rightVideo}
        leftMarkers={markers?.left || []}
        rightMarkers={markers?.right || []}
        syncOffset={syncOffset}
        playbackSpeed={speed}
      />

      <div onClick={(e) => e.stopPropagation()}>
        {activeMenu === 'tools' && (
          <ToolMenu
            tool={tool}
            setTool={setTool}
            onClose={() => setActiveMenu(null)}
          />
        )}
        {activeMenu === 'style' && <StyleMenu color={color} setColor={setColor} lineWidth={lineWidth} setLineWidth={setLineWidth} />}
        {activeMenu === 'speed' && (
          <SpeedMenu
            speed={speed}
            changeSpeed={changeSpeed}
            onClose={() => setActiveMenu(null)}
          />
        )}
      </div>

      <header className="h-11 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4 shrink-0 z-20">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/swingstr-logo.jpg"
              alt="Swingstr"
              className="h-8 w-8 rounded-full border-2 border-purple-500 object-cover"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <h1 className="font-bold text-lg tracking-tight text-white">
              Swing<span className="text-purple-500">str</span>
            </h1>
          </div>
          <button
            onClick={onOpenLibrary}
            className="text-xs bg-gray-800 px-3 py-1.5 rounded-full hover:bg-gray-700 flex items-center gap-1 border border-gray-700"
          >
            <Users size={12} /> Student Library
          </button>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => {
                setLayout('single');
                setActiveScreen('left');
              }}
              aria-label="Single screen layout"
              aria-pressed={layout === 'single'}
              className={`p-1.5 rounded ${layout === 'single' ? 'bg-gray-600 text-white' : 'text-gray-400'}`}
            >
              <Maximize size={18} />
            </button>
            <button
              onClick={() => setLayout('split')}
              aria-label="Split screen layout"
              aria-pressed={layout === 'split'}
              className={`p-1.5 rounded ${layout === 'split' ? 'bg-gray-600 text-white' : 'text-gray-400'}`}
            >
              <SplitSquareHorizontal size={18} />
            </button>
          </div>
          {layout === 'split' && (
            <>
              <button
                onClick={() => setSync(!sync)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${sync ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
              >
                {sync ? <LinkIcon size={16} /> : <Link2Off size={16} />}{' '}
                {sync ? 'Linked' : 'Unlinked'}
              </button>
              {sync && (
                <div className="flex items-center gap-1">
                  {/* Left sync point */}
                  <button
                    onClick={() => syncPoints.left != null ? onClearSyncPoint('left') : onSetSyncPoint('left')}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                      syncPoints.left != null
                        ? 'bg-amber-600/30 text-amber-400 border border-amber-600/50'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700'
                    }`}
                    title={syncPoints.left != null ? `L sync: ${syncPoints.left.toFixed(2)}s — click to clear` : 'Set left sync point'}
                  >
                    <Crosshair size={12} />
                    L
                    {syncPoints.left != null ? <Check size={10} /> : null}
                  </button>
                  {/* Right sync point */}
                  <button
                    onClick={() => syncPoints.right != null ? onClearSyncPoint('right') : onSetSyncPoint('right')}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                      syncPoints.right != null
                        ? 'bg-amber-600/30 text-amber-400 border border-amber-600/50'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700'
                    }`}
                    title={syncPoints.right != null ? `R sync: ${syncPoints.right.toFixed(2)}s — click to clear` : 'Set right sync point'}
                  >
                    <Crosshair size={12} />
                    R
                    {syncPoints.right != null ? <Check size={10} /> : null}
                  </button>
                  {hasSyncOffset && (
                    <span className="text-[10px] text-amber-400/60 ml-1">synced</span>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <GoogleAuthButton
            isSignedIn={isSignedIn}
            userEmail={userEmail}
            onSignIn={onSignIn}
            onSignOut={onSignOut}
          />
          <Button onClick={() => adjustZoom(-0.2)} title="Zoom out" aria-label="Zoom out">
            <ZoomOut size={18} />
          </Button>
          <span className="w-12 text-center font-mono text-sm text-purple-400 font-bold" aria-live="polite">
            {zooms[activeScreen].toFixed(1)}x
          </span>
          <Button onClick={() => adjustZoom(0.2)} title="Zoom in" aria-label="Zoom in">
            <ZoomIn size={18} />
          </Button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden bg-black relative">
        <ScreenPane
          side="left"
          layout={layout}
          active={activeScreen === 'left'}
          ref={leftRef}
          src={leftVideo}
          tool={tool}
          color={color}
          lineWidth={lineWidth}
          playbackRate={speed}
          zoomLevel={zooms.left}
          onActivate={() => setActiveScreen('left')}
          onUpload={(e) => onUpload('left', e)}
          onUrlUpload={() => onUrlUpload('left')}
          onDriveUpload={() => setDrivePickerSide('left')}
          isSignedIn={isSignedIn}
          onClear={() => onClearVideo('left')}
          isSynced={sync}
          onScrub={onLinkedScrub}
          onTimeUpdate={onTimeUpdate}
          trimStart={trims.left.start}
          trimEnd={trims.left.end}
          poseFrames={poseState.left.frames}
          showSkeleton={poseState.left.showSkeleton}
          viewType={viewTypes.left}
          handedness={handedness.left}
        />

        {layout === 'split' && (
          <ScreenPane
            side="right"
            layout={layout}
            active={activeScreen === 'right'}
            containerClassName="border-l border-gray-800"
            ref={rightRef}
            src={rightVideo}
            tool={tool}
            color={color}
            lineWidth={lineWidth}
            playbackRate={speed}
            zoomLevel={zooms.right}
            onActivate={() => setActiveScreen('right')}
            onUpload={(e) => onUpload('right', e)}
            onUrlUpload={() => onUrlUpload('right')}
            onDriveUpload={() => setDrivePickerSide('right')}
            isSignedIn={isSignedIn}
            onClear={() => onClearVideo('right')}
            isSynced={sync}
            onScrub={onLinkedScrub}
            onTimeUpdate={onTimeUpdate}
            trimStart={trims.right.start}
            trimEnd={trims.right.end}
            poseFrames={poseState.right.frames}
            showSkeleton={poseState.right.showSkeleton}
            viewType={viewTypes.right}
            handedness={handedness.right}
          />
        )}
      </main>

      {/* Angle-over-time graph (plan section 7) — renders nothing until a
          pane has a finished analysis and a view-type tag. */}
      <SwingGraphPanel
        poseState={poseState}
        viewTypes={viewTypes}
        handedness={handedness}
        activeScreen={activeScreen}
        trims={trims}
        globalTime={globalTime}
        globalDuration={globalDuration}
        onSeek={onGraphSeek}
        markers={markers}
        layout={layout}
      />

      <footer className="footer-mobile-safe bg-gray-800 border-t border-gray-700 flex flex-col shrink-0 z-30">
        <div className="w-full px-4 py-0 flex items-center gap-3 border-b border-gray-700 bg-gray-800">
          <span className="text-xs font-mono text-gray-400 w-12 text-right">
            {globalTime.toFixed(1)}s
          </span>
          <div className="flex-1 relative">
            <input
              type="range"
              min="0"
              max={globalDuration || 100}
              step="0.01"
              value={globalTime}
              onChange={onGlobalScrub}
              aria-label="Video timeline"
              className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400"
            />
            {/* Trimmed-out regions shaded on the timeline */}
            {globalDuration > 0 && activeTrim.start != null && (
              <div
                className="absolute top-0 bottom-0 left-0 bg-black/60 border-r-2 border-emerald-400/80 rounded-l-lg z-10 pointer-events-none"
                style={{ width: `${(activeTrim.start / globalDuration) * 100}%` }}
                title={`Trim start: ${activeTrim.start.toFixed(2)}s`}
              />
            )}
            {globalDuration > 0 && activeTrim.end != null && (
              <div
                className="absolute top-0 bottom-0 right-0 bg-black/60 border-l-2 border-emerald-400/80 rounded-r-lg z-10 pointer-events-none"
                style={{ width: `${(Math.max(0, globalDuration - activeTrim.end) / globalDuration) * 100}%` }}
                title={`Trim end: ${activeTrim.end.toFixed(2)}s`}
              />
            )}
            {/* Sync point indicators on timeline */}
            {globalDuration > 0 && syncPoints.left != null && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-amber-400/70 z-20 pointer-events-none"
                style={{ left: `${(syncPoints.left / globalDuration) * 100}%` }}
                title={`L sync: ${syncPoints.left.toFixed(2)}s`}
              >
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[3px] border-r-[3px] border-t-[4px] border-l-transparent border-r-transparent border-t-amber-400" />
              </div>
            )}
            {globalDuration > 0 && syncPoints.right != null && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-amber-500/70 z-20 pointer-events-none"
                style={{ left: `${(syncPoints.right / globalDuration) * 100}%` }}
                title={`R sync: ${syncPoints.right.toFixed(2)}s`}
              >
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[3px] border-r-[3px] border-b-[4px] border-l-transparent border-r-transparent border-b-amber-500" />
              </div>
            )}
            {/* Marker diamonds on timeline */}
            {globalDuration > 0 && activeMarkers.map((m) => (
              <button
                key={m.index}
                onClick={() => onJumpToMarker(m.index)}
                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-purple-400 border border-purple-300 hover:bg-purple-300 hover:scale-125 transition-all z-10 pointer-events-auto"
                style={{ left: `${(m.time / globalDuration) * 100}%`, transform: 'translateX(-50%) translateY(-50%) rotate(45deg)' }}
                title={`${m.label} (${m.time.toFixed(2)}s)`}
              />
            ))}
          </div>
          <span className="text-xs font-mono text-gray-400 w-12">
            {globalDuration.toFixed(1)}s
          </span>
          {/* Trim controls — apply to the active screen's video */}
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => onSetTrim('start')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                activeTrim.start != null
                  ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-600/50'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600 border border-gray-600'
              }`}
              title={activeTrim.start != null ? `Trim start: ${activeTrim.start.toFixed(2)}s — click to move to current frame` : 'Set trim start at current frame'}
            >
              <Scissors size={12} />
              In
              {activeTrim.start != null ? <Check size={10} /> : null}
            </button>
            <button
              onClick={() => onSetTrim('end')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                activeTrim.end != null
                  ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-600/50'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600 border border-gray-600'
              }`}
              title={activeTrim.end != null ? `Trim end: ${activeTrim.end.toFixed(2)}s — click to move to current frame` : 'Set trim end at current frame'}
            >
              Out
              {activeTrim.end != null ? <Check size={10} /> : null}
            </button>
            {(activeTrim.start != null || activeTrim.end != null) && (
              <button
                onClick={onClearTrim}
                className="p-1 rounded text-gray-400 hover:text-red-400 hover:bg-red-900/30"
                title="Clear trim"
                aria-label="Clear trim"
              >
                <X size={12} />
              </button>
            )}
            <div className="w-px h-4 bg-gray-600 mx-1" />
            {/* Pose skeleton overlay — analyze the active screen's video,
                then toggle the overlay on/off once done. */}
            {activePose.status === 'analyzing' ? (
              <div className="flex items-center gap-1">
                <span className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-sky-600/20 text-sky-400 border border-sky-600/40">
                  <Loader2 size={12} className="animate-spin" />
                  {Math.round(activePose.progress * 100)}%
                </span>
                <button
                  onClick={onCancelAnalysis}
                  className="p-1 rounded text-gray-400 hover:text-red-400 hover:bg-red-900/30"
                  title="Cancel analysis"
                  aria-label="Cancel analysis"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button
                onClick={activePose.status === 'done' ? onToggleSkeleton : onAnalyze}
                disabled={poseBusy}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors border disabled:opacity-40 disabled:cursor-not-allowed ${
                  activePose.status === 'done' && activePose.showSkeleton
                    ? 'bg-sky-600/30 text-sky-400 border-sky-600/50'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600 border-gray-600'
                }`}
                title={
                  activePose.status === 'done'
                    ? (activePose.showSkeleton ? 'Hide skeleton overlay' : 'Show skeleton overlay')
                    : 'Analyze swing (pose skeleton)'
                }
              >
                <PersonStanding size={12} />
                {activePose.status === 'done' ? 'Skeleton' : 'Analyze'}
                {activePose.status === 'done' && activePose.showSkeleton ? <Check size={10} /> : null}
              </button>
            )}
            <div className="w-px h-4 bg-gray-600 mx-1" />
            {/* View tagging (plan 6.1) — user picks the camera angle per
                pane, no auto-detection; angle readouts key off this. */}
            <button
              onClick={() => onSetViewType('dtl')}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors border ${
                activeViewType === 'dtl'
                  ? 'bg-sky-600/30 text-sky-400 border-sky-600/50'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600 border-gray-600'
              }`}
              title="Tag this pane as down-the-line view"
            >
              DTL
            </button>
            <button
              onClick={() => onSetViewType('face-on')}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors border ${
                activeViewType === 'face-on'
                  ? 'bg-sky-600/30 text-sky-400 border-sky-600/50'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600 border-gray-600'
              }`}
              title="Tag this pane as face-on view"
            >
              FO
            </button>
            {activeViewType === 'face-on' && (
              <button
                onClick={onToggleHandedness}
                className="px-2 py-1 rounded text-xs font-medium bg-gray-700 text-gray-400 hover:bg-gray-600 border border-gray-600"
                title="Golfer handedness — sets which arm is 'lead' for the lead-arm angle"
              >
                {activeHandedness}
              </button>
            )}
          </div>
        </div>

        <MarkerBar
          markers={activeMarkers}
          duration={globalDuration}
          currentTime={globalTime}
          onJumpTo={onJumpToMarker}
          onSetMarker={onSetMarker}
          onRemoveMarker={onRemoveMarker}
          onPrev={onPrevMarker}
          onNext={onNextMarker}
        />

        <div className="flex items-center justify-between px-4 h-9">
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <IconButton
              onClick={() => setTool('move')}
              active={tool === 'move'}
              title="Move/Pan"
            >
              <MousePointer2 size={20} />
            </IconButton>
            <div className="w-px h-6 bg-gray-700 mx-1" />

            <MenuButton
              icon={PenTool}
              label="Drawing"
              active={['line', 'angle', 'circle', 'rect', 'free', 'blur', 'select'].includes(tool)}
              isOpen={activeMenu === 'tools'}
              onClick={() => setActiveMenu(activeMenu === 'tools' ? null : 'tools')}
            />

            <MenuButton
              icon={Palette}
              label="Style"
              active={false}
              isOpen={activeMenu === 'style'}
              onClick={() => setActiveMenu(activeMenu === 'style' ? null : 'style')}
            />

            <div className="w-px h-6 bg-gray-700 mx-1" />
            <IconButton
              onClick={clearShapes}
              title="Clear All"
              className="text-red-400 hover:bg-red-900/30"
            >
              <Trash2 size={20} />
            </IconButton>
          </div>

          <div className="flex items-center gap-4 absolute left-1/2 -translate-x-1/2">
            <button
              onClick={() => seek(-0.05)}
              aria-label="Previous frame"
              title="Previous frame (←)"
              className="text-gray-400 hover:text-white"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              aria-pressed={isPlaying}
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              className="bg-purple-600 text-white p-1.5 rounded-full hover:bg-purple-500 shadow-lg active:scale-95"
            >
              {isPlaying ? (
                <Pause size={20} fill="currentColor" />
              ) : (
                <Play size={20} fill="currentColor" className="ml-1" />
              )}
            </button>
            <button
              onClick={() => seek(0.05)}
              aria-label="Next frame"
              title="Next frame (→)"
              className="text-gray-400 hover:text-white"
            >
              <ChevronRight size={24} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <MenuButton
              icon={Gauge}
              label={`${speed}x`}
              active={false}
              isOpen={activeMenu === 'speed'}
              onClick={() => setActiveMenu(activeMenu === 'speed' ? null : 'speed')}
            />
            <IconButton onClick={onSnapshot} title="Snapshot">
              <Camera size={20} />
            </IconButton>
            <IconButton
              onClick={() => setShowSequenceModal(true)}
              title="Export (sequence or video)"
            >
              <Download size={20} />
            </IconButton>
            <IconButton
              onClick={openSaveModal}
              title="Save to Student"
              className="text-purple-400 hover:text-purple-200"
            >
              <Save size={20} />
            </IconButton>
          </div>
        </div>
      </footer>
    </div>
  );
}
