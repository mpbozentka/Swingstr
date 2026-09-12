import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  ChevronRight,
  ChevronLeft,
  ZoomIn,
  ZoomOut,
  SplitSquareHorizontal,
  Link as LinkIcon,
  Link2Off,
  Maximize,
  Users,
  Crosshair,
  Check,
} from 'lucide-react';
import { Button } from './ui/Button';
import ScreenPane from './ScreenPane';
import LeftRail from './LeftRail';
import SaveModal from './SaveModal';
import Timeline from './Timeline';
import ExportModal from './ExportModal';
import GoogleAuthButton from './GoogleAuthButton';
import DrivePickerModal from './DrivePickerModal';

// The floating control bar is sized by a single scale factor rather than an
// explicit width/height, so the buttons, text and scrub track all shrink
// together — dragging it smaller actually gets it out of the way instead of
// just cramming the same big controls into a narrower box.
const BAR_SCALE_KEY = 'swingstr_bar_scale';
const BAR_SCALE_MIN = 0.45;
const BAR_SCALE_MAX = 1;

const clampBarScale = (v) => Math.min(BAR_SCALE_MAX, Math.max(BAR_SCALE_MIN, v));

function readBarScale() {
  try {
    const saved = parseFloat(localStorage.getItem(BAR_SCALE_KEY));
    if (Number.isFinite(saved)) return clampBarScale(saved);
  } catch {
    // storage disabled — fall through to full size
  }
  return BAR_SCALE_MAX;
}

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
  openSaveModal,
  globalTime,
  globalDuration,
  onGlobalScrub,
  onTimeUpdate,
  onPlayStateChange,
  onLinkedScrub,
  showSequenceModal,
  setShowSequenceModal,
  markers,
  trims,
  activeTrim,
  onSetTrim,
  onClearTrim,
  syncPoints,
  hasSyncOffset,
  syncOffset = 0,
  onSetSyncPoint,
  onClearSyncPoint,
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

  const [barScale, setBarScale] = useState(readBarScale);
  const barRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(BAR_SCALE_KEY, String(barScale));
    } catch {
      // storage disabled — the size just won't survive a restart
    }
  }, [barScale]);

  /**
   * The bar is pinned by its bottom-right corner, so the horizontal gap
   * between the pointer and that corner IS the bar's on-screen width. Divide
   * by its unscaled width and you have the new scale outright — reading the
   * absolute position each move instead of accumulating deltas, so a long
   * drag can't drift away from the cursor.
   */
  const startBarResize = useCallback((e) => {
    const el = barRef.current;
    if (!el) return;
    e.preventDefault();

    const rect = el.getBoundingClientRect(); // already includes the transform
    const unscaledWidth = rect.width / barScale;
    const anchorRight = rect.right;

    const onMove = (ev) => setBarScale(clampBarScale((anchorRight - ev.clientX) / unscaledWidth));
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [barScale]);

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

      {/* Everything below the header. The video fills the region; the tool
          rail and the transport bar float on glass over it. */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
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
          onPlayStateChange={onPlayStateChange}
          trimStart={trims.left.start}
          trimEnd={trims.left.end}
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
          onPlayStateChange={onPlayStateChange}
            trimStart={trims.right.start}
            trimEnd={trims.right.end}
          />
        )}
        <LeftRail
          tool={tool}
          setTool={setTool}
          color={color}
          setColor={setColor}
          lineWidth={lineWidth}
          setLineWidth={setLineWidth}
          speed={speed}
          changeSpeed={changeSpeed}
          activeMenu={activeMenu}
          setActiveMenu={setActiveMenu}
          clearShapes={clearShapes}
          activeTrim={activeTrim}
          onSetTrim={onSetTrim}
          onClearTrim={onClearTrim}
          onExport={() => setShowSequenceModal(true)}
          onSave={openSaveModal}
        />

        {/* Scrubber and transport, floating on glass over the footage. Left
            inset clears the tool rail. Scaled from the bottom-right corner so
            the drag grip on the left edge shrinks the whole thing toward the
            corner it's pinned to. */}
        <div
          ref={barRef}
          className="footer-mobile-safe absolute bottom-4 left-20 right-4 z-30 rounded-2xl bg-gray-900/45 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/50 flex flex-col py-1"
          style={{ transform: `scale(${barScale})`, transformOrigin: 'bottom right' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Resize grip. Counter-scaled so it stays the same grabbable size
              no matter how small the bar itself gets. */}
          <div
            onPointerDown={startBarResize}
            onDoubleClick={() => setBarScale(BAR_SCALE_MAX)}
            role="separator"
            aria-label="Resize control bar"
            title="Drag to resize the control bar — double-click to reset"
            className="absolute left-0 top-1/2 w-4 h-12 flex items-center justify-center cursor-ew-resize touch-none group"
            style={{ transform: `translate(-50%, -50%) scale(${1 / barScale})` }}
          >
            <div className="w-1 h-9 rounded-full bg-white/25 group-hover:bg-white/70 transition-colors" />
          </div>
          <Timeline
            globalTime={globalTime}
            globalDuration={globalDuration}
            onScrub={onGlobalScrub}
            activeTrim={activeTrim}
            syncPoints={syncPoints}
            markers={markers}
            activeScreen={activeScreen}
            sync={sync}
            hasSyncOffset={hasSyncOffset}
            syncOffset={syncOffset}
            hasBothVideos={layout === 'split' && !!leftVideo && !!rightVideo}
            onJumpTo={onJumpToMarker}
            onSetMarker={onSetMarker}
            onRemoveMarker={onRemoveMarker}
            onPrev={onPrevMarker}
            onNext={onNextMarker}
          />

          <div className="flex items-center justify-center gap-5 pb-1">
            <button
              onClick={() => seek(-0.05)}
              aria-label="Previous frame"
              title="Previous frame (←)"
              className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 border border-white/10 text-gray-200 hover:bg-white/15 hover:text-white transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              aria-pressed={isPlaying}
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-purple-500/80 backdrop-blur border border-purple-300/40 text-white hover:bg-purple-500 shadow-lg shadow-purple-900/40 active:scale-95 transition-all"
            >
              {isPlaying ? (
                <Pause size={20} fill="currentColor" />
              ) : (
                <Play size={20} fill="currentColor" className="ml-0.5" />
              )}
            </button>
            <button
              onClick={() => seek(0.05)}
              aria-label="Next frame"
              title="Next frame (→)"
              className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 border border-white/10 text-gray-200 hover:bg-white/15 hover:text-white transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </main>

      </div>
    </div>
  );
}
