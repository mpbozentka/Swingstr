import React from 'react';
import {
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
  PersonStanding,
} from 'lucide-react';
import { Button, IconButton, MenuButton } from './ui/Button';
import ScreenPane from './ScreenPane';
import ToolMenu from './ToolMenu';
import StyleMenu from './StyleMenu';
import SpeedMenu from './SpeedMenu';
import SaveModal from './SaveModal';
import MarkerBar from './MarkerBar';
import SwingSequenceModal from './SwingSequenceModal';
import GoogleAuthButton from './GoogleAuthButton';
import DrivePickerModal from './DrivePickerModal';

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
  showSkeleton,
  setShowSkeleton,
  isPlaying,
  togglePlay,
  seek,
  clearShapes,
  onSnapshot,
  openSaveModal,
  globalTime,
  globalDuration,
  onGlobalScrub,
  onTimeUpdate,
  onLinkedScrub,
  showSequenceModal,
  setShowSequenceModal,
  markers,
  syncPoints,
  hasSyncOffset,
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

      <SwingSequenceModal
        show={showSequenceModal}
        onClose={() => setShowSequenceModal(false)}
        leftRef={leftRef}
        rightRef={rightRef}
        leftVideo={leftVideo}
        rightVideo={rightVideo}
        leftMarkers={markers?.left || []}
        rightMarkers={markers?.right || []}
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

      <header className="min-h-14 bg-gray-900 border-b border-gray-800 flex flex-wrap items-center justify-between gap-y-2 py-2 sm:py-0 px-3 sm:px-4 shrink-0 z-20">
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <img
              src="/swingstr-logo.jpg"
              alt="Swingstr"
              className="h-8 w-8 sm:h-10 sm:w-10 rounded-full border-2 border-purple-500 object-cover"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <h1 className="font-bold text-base sm:text-lg tracking-tight text-white">
              Swing<span className="text-purple-500">str</span>
            </h1>
          </div>
          <button
            onClick={onOpenLibrary}
            aria-label="Student Library"
            className="text-xs bg-gray-800 px-2.5 sm:px-3 py-1.5 rounded-full hover:bg-gray-700 flex items-center gap-1 border border-gray-700"
          >
            <Users size={12} /> <span className="hidden sm:inline">Student Library</span>
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
        <div className="flex items-center gap-1.5 sm:gap-3">
          <GoogleAuthButton
            isSignedIn={isSignedIn}
            userEmail={userEmail}
            onSignIn={onSignIn}
            onSignOut={onSignOut}
          />
          <Button onClick={() => adjustZoom(-0.2)} title="Zoom out" aria-label="Zoom out">
            <ZoomOut size={18} />
          </Button>
          <span className="w-10 sm:w-12 text-center font-mono text-sm text-purple-400 font-bold" aria-live="polite">
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
          showSkeleton={showSkeleton}
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
            showSkeleton={showSkeleton}
          />
        )}
      </main>

      <footer className="footer-mobile-safe bg-gray-800 border-t border-gray-700 flex flex-col shrink-0 z-30 pb-4">
        <div className="w-full px-4 pt-2 pb-1 flex items-center gap-3 border-b border-gray-700 bg-gray-800">
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

        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between px-2 sm:px-4 py-2 gap-3 sm:gap-0 sm:h-14">
          {/* Playback transport — own centered row on mobile, absolutely centered on desktop */}
          <div className="flex items-center justify-center gap-8 sm:gap-4 order-1 sm:order-none sm:absolute sm:left-1/2 sm:-translate-x-1/2">
            <button
              onClick={() => seek(-0.05)}
              aria-label="Previous frame"
              title="Previous frame (←)"
              className="text-gray-400 hover:text-white"
            >
              <ChevronLeft size={28} />
            </button>
            <button
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              aria-pressed={isPlaying}
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              className="bg-purple-600 text-white p-2 rounded-full hover:bg-purple-500 shadow-lg active:scale-95"
            >
              {isPlaying ? (
                <Pause size={24} fill="currentColor" />
              ) : (
                <Play size={24} fill="currentColor" className="ml-1" />
              )}
            </button>
            <button
              onClick={() => seek(0.05)}
              aria-label="Next frame"
              title="Next frame (→)"
              className="text-gray-400 hover:text-white"
            >
              <ChevronRight size={28} />
            </button>
          </div>

          {/* Tool buttons — single wrapping row on mobile; restored to left/right groups on desktop */}
          <div className="flex items-center justify-center flex-wrap gap-1 sm:gap-2 order-2 sm:order-none sm:contents">
            <div className="flex items-center gap-1 sm:gap-2" onClick={(e) => e.stopPropagation()}>
              <IconButton
                onClick={() => setTool('move')}
                active={tool === 'move'}
                title="Move/Pan"
              >
                <MousePointer2 size={20} />
              </IconButton>
              <div className="w-px h-8 bg-gray-700 mx-1" />

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

              <div className="w-px h-8 bg-gray-700 mx-1" />
              <IconButton
                onClick={clearShapes}
                title="Clear All"
                className="text-red-400 hover:bg-red-900/30"
              >
                <Trash2 size={20} />
              </IconButton>
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              <MenuButton
                icon={Gauge}
                label={`${speed}x`}
                active={false}
                isOpen={activeMenu === 'speed'}
                onClick={() => setActiveMenu(activeMenu === 'speed' ? null : 'speed')}
              />
              <IconButton
                onClick={() => setShowSkeleton(!showSkeleton)}
                active={showSkeleton}
                title="Stick figure overlay"
              >
                <PersonStanding size={20} />
              </IconButton>
              <IconButton onClick={onSnapshot} title="Snapshot">
                <Camera size={20} />
              </IconButton>
              <IconButton
                onClick={() => setShowSequenceModal(true)}
                title="Swing Sequence Export"
              >
                <LayoutGrid size={20} />
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
        </div>
      </footer>
    </div>
  );
}
