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
  LogOut,
} from 'lucide-react';
import { Button, IconButton, MenuButton } from './ui/Button';
import VideoCanvas from './VideoCanvas';
import ToolMenu from './ToolMenu';
import StyleMenu from './StyleMenu';
import SpeedMenu from './SpeedMenu';
import SaveModal from './SaveModal';

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
  onTimeUpdate,
  onLinkedScrub,
  students,
  showSaveModal,
  setShowSaveModal,
  saveData,
  setSaveData,
  saveToStudent,
  user,
  onLogout,
}) {
  return (
    <div
      className="h-screen w-screen bg-gray-900 text-gray-100 flex flex-col font-sans relative"
      onClick={() => setActiveMenu(null)}
    >
      <SaveModal
        show={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        students={students}
        saveData={saveData}
        setSaveData={setSaveData}
        onSave={saveToStudent}
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

      <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4 shrink-0 z-20">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/swingstr-logo.jpg"
              alt="Swingstr"
              className="h-10 w-10 rounded-full border-2 border-purple-500 object-cover"
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
          {onLogout && (
            <button
              onClick={onLogout}
              className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
              title="Sign out"
            >
              <LogOut size={12} /> Sign out
            </button>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => {
                setLayout('single');
                setActiveScreen('left');
              }}
              className={`p-1.5 rounded ${layout === 'single' ? 'bg-gray-600 text-white' : 'text-gray-400'}`}
            >
              <Maximize size={18} />
            </button>
            <button
              onClick={() => setLayout('split')}
              className={`p-1.5 rounded ${layout === 'split' ? 'bg-gray-600 text-white' : 'text-gray-400'}`}
            >
              <SplitSquareHorizontal size={18} />
            </button>
          </div>
          {layout === 'split' && (
            <button
              onClick={() => setSync(!sync)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${sync ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
            >
              {sync ? <LinkIcon size={16} /> : <Link2Off size={16} />}{' '}
              {sync ? 'Linked' : 'Unlinked'}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => adjustZoom(-0.2)}>
            <ZoomOut size={18} />
          </Button>
          <span className="w-12 text-center font-mono text-sm text-purple-400 font-bold">
            {zooms[activeScreen].toFixed(1)}x
          </span>
          <Button onClick={() => adjustZoom(0.2)}>
            <ZoomIn size={18} />
          </Button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden bg-black relative">
        <div
          className={`h-full relative flex flex-col ${layout === 'split' ? 'w-1/2' : 'w-full'} ${activeScreen === 'left' ? 'z-10' : 'z-0'}`}
        >
          {activeScreen === 'left' && (
            <div className="absolute top-4 left-4 bg-purple-600 text-xs font-bold px-2 py-1 rounded z-20 pointer-events-none">
              ACTIVE
            </div>
          )}
          <VideoCanvas
            ref={leftRef}
            src={leftVideo}
            tool={tool}
            color={color}
            lineWidth={lineWidth}
            playbackRate={speed}
            zoomLevel={zooms.left}
            isActive={activeScreen === 'left'}
            onActivate={() => setActiveScreen('left')}
            onUpload={(e) => onUpload('left', e)}
            onUrlUpload={() => onUrlUpload('left')}
            onClear={() => onClearVideo('left')}
            isSynced={sync}
            onScrub={onLinkedScrub}
            onTimeUpdate={onTimeUpdate}
          />
        </div>

        {layout === 'split' && (
          <div
            className={`h-full flex flex-col border-l border-gray-800 relative ${activeScreen === 'right' ? 'z-10' : 'z-0'} w-1/2`}
          >
            {activeScreen === 'right' && (
              <div className="absolute top-4 left-4 bg-purple-600 text-xs font-bold px-2 py-1 rounded z-20 pointer-events-none">
                ACTIVE
              </div>
            )}
            <VideoCanvas
              ref={rightRef}
              src={rightVideo}
              tool={tool}
              color={color}
              lineWidth={lineWidth}
              playbackRate={speed}
              zoomLevel={zooms.right}
              isActive={activeScreen === 'right'}
              onActivate={() => setActiveScreen('right')}
              onUpload={(e) => onUpload('right', e)}
              onUrlUpload={() => onUrlUpload('right')}
              onClear={() => onClearVideo('right')}
              isSynced={sync}
              onScrub={onLinkedScrub}
              onTimeUpdate={onTimeUpdate}
            />
          </div>
        )}
      </main>

      <footer className="bg-gray-800 border-t border-gray-700 flex flex-col shrink-0 z-30">
        <div className="w-full px-4 pt-2 pb-1 flex items-center gap-3 border-b border-gray-700 bg-gray-800">
          <span className="text-xs font-mono text-gray-400 w-12 text-right">
            {globalTime.toFixed(1)}s
          </span>
          <input
            type="range"
            min="0"
            max={globalDuration || 100}
            step="0.01"
            value={globalTime}
            onChange={onGlobalScrub}
            className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400"
          />
          <span className="text-xs font-mono text-gray-400 w-12">
            {globalDuration.toFixed(1)}s
          </span>
        </div>

        <div className="flex items-center justify-between px-4 py-2 h-14">
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
              active={['line', 'angle', 'circle', 'rect', 'free', 'blur'].includes(tool)}
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

          <div className="flex items-center gap-4 absolute left-1/2 -translate-x-1/2">
            <button
              onClick={() => seek(-0.05)}
              className="text-gray-400 hover:text-white"
            >
              <ChevronLeft size={28} />
            </button>
            <button
              onClick={togglePlay}
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
              className="text-gray-400 hover:text-white"
            >
              <ChevronRight size={28} />
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
