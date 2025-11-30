import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { 
  Play, Pause, Upload, Trash2, MousePointer2, Minus, 
  Circle as CircleIcon, Square, Edit2, Video, 
  ChevronRight, ChevronLeft, ZoomIn, ZoomOut,
  SplitSquareHorizontal, Link as LinkIcon, Link2Off, Maximize,
  Camera, Users, Save, X, UserPlus, FileVideo, EyeOff, Globe,
  Pencil, StickyNote, Palette, PenTool, Gauge
} from 'lucide-react';

// --- UI Components ---

const Button = ({ onClick, active, children, className = "", title = "", disabled }) => (
  <button
    onClick={onClick}
    title={title}
    disabled={disabled}
    className={`p-2 rounded-lg transition-all duration-200 flex items-center justify-center ${
      active 
        ? 'bg-purple-600 text-white shadow-lg scale-105' 
        : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
    } ${className} disabled:opacity-50 disabled:cursor-not-allowed`}
  >
    {children}
  </button>
);

const IconButton = ({ onClick, active, children, title, className = "" }) => (
  <button
    onClick={onClick}
    title={title}
    className={`p-2 rounded-lg transition-all flex items-center justify-center ${
      active 
        ? 'bg-purple-600 text-white shadow-lg' 
        : 'text-gray-400 hover:bg-gray-700 hover:text-white'
    } ${className}`}
  >
    {children}
  </button>
);

const MenuButton = ({ icon: Icon, label, active, onClick, isOpen }) => (
    <button 
        onClick={onClick}
        className={`relative flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
            active || isOpen ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
        }`}
    >
        <Icon size={18} className={active ? 'text-purple-400' : ''} />
        <span className="text-sm font-medium">{label}</span>
        {isOpen && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-700 rotate-45 translate-y-1"></div>}
    </button>
);

const calculateAngle = (p1, p2, p3) => {
  const angle1 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  const angle2 = Math.atan2(p3.y - p1.y, p3.x - p1.x);
  let angle = (angle2 - angle1) * (180 / Math.PI);
  if (angle < 0) angle += 360;
  if (angle > 180) angle = 360 - angle;
  return Math.round(angle);
};

// --- Video Canvas ---
const VideoCanvas = forwardRef(({ 
  src, tool, color, lineWidth, playbackRate, zoomLevel,
  isActive, onActivate, onUpload, onUrlUpload, onClear, // Added onClear prop
  isSynced, onScrub, onTimeUpdate 
}, ref) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const isPanning = useRef(false);
  const [shapes, setShapes] = useState([]);
  const [currentShape, setCurrentShape] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [points, setPoints] = useState([]); 
  
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Expose methods
  useImperativeHandle(ref, () => ({
    play: () => videoRef.current?.play().catch(e => {}),
    pause: () => videoRef.current?.pause(),
    seekRelative: (s) => { if (videoRef.current) videoRef.current.currentTime += s },
    seekTo: (t) => { if (videoRef.current) videoRef.current.currentTime = t },
    setPlaybackRate: (r) => { if (videoRef.current) videoRef.current.playbackRate = r },
    clearShapes: () => setShapes([]),
    getSnapshot: takeSnapshot,
    hasVideo: !!src,
    currentTime: videoRef.current?.currentTime || 0,
    duration: videoRef.current?.duration || 0
  }));

  // Snapshot Logic
  const takeSnapshot = async () => {
    if (!videoRef.current || !canvasRef.current) return null;
    const vid = videoRef.current;
    if (vid.videoWidth === 0) return null;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = vid.videoWidth;
    tempCanvas.height = vid.videoHeight;
    const ctx = tempCanvas.getContext('2d');

    try { ctx.drawImage(vid, 0, 0, tempCanvas.width, tempCanvas.height); } 
    catch (e) { console.error("CORS Error"); return null; }

    const scaleX = vid.videoWidth / containerRef.current.clientWidth;
    const scaleY = vid.videoHeight / containerRef.current.clientHeight;

    const renderToContext = (context, s) => {
        context.save();
        context.scale(scaleX, scaleY);
        context.strokeStyle = s.color;
        context.lineWidth = s.width / zoomLevel; 
        context.beginPath();
        if (s.type === 'line') { context.moveTo(s.start.x, s.start.y); context.lineTo(s.end.x, s.end.y); }
        else if (s.type === 'rect') { context.strokeRect(s.start.x, s.start.y, s.end.x - s.start.x, s.end.y - s.start.y); }
        else if (s.type === 'circle') { const r = Math.sqrt(Math.pow(s.end.x - s.start.x, 2) + Math.pow(s.end.y - s.start.y, 2)); context.beginPath(); context.arc(s.start.x, s.start.y, r, 0, 2 * Math.PI); }
        else if (s.type === 'blur') {
            const cX = (s.start.x + s.end.x) / 2; const cY = (s.start.y + s.end.y) / 2;
            const rX = Math.abs(s.end.x - s.start.x) / 2; const rY = Math.abs(s.end.y - s.start.y) / 2;
            context.beginPath(); context.ellipse(cX, cY, rX, rY, 0, 0, 2 * Math.PI);
        }
        else if (s.type === 'free' && s.points.length > 0) { context.moveTo(s.points[0].x, s.points[0].y); s.points.forEach(p => context.lineTo(p.x, p.y)); }
        else if (s.type === 'angle') { 
            context.beginPath(); context.arc(s.p1.x, s.p1.y, 4, 0, Math.PI * 2);
            if (s.p2 && s.p3) { context.moveTo(s.p1.x, s.p1.y); context.lineTo(s.p2.x, s.p2.y); context.moveTo(s.p1.x, s.p1.y); context.lineTo(s.p3.x, s.p3.y); }
        }

        if (s.type === 'blur') {
            context.clip(); context.filter = 'blur(15px)'; context.setTransform(1, 0, 0, 1, 0, 0);
            try { context.drawImage(vid, 0, 0, tempCanvas.width, tempCanvas.height); } catch(e){}
        } else { context.stroke(); }
        context.restore();
    };
    shapes.forEach(s => renderToContext(ctx, s));
    return tempCanvas.toDataURL('image/jpeg', 0.9);
  };

  useEffect(() => { if (videoRef.current) videoRef.current.playbackRate = playbackRate; }, [playbackRate]);
  useEffect(() => { if (zoomLevel === 1.0) { setPanX(0); setPanY(0); } }, [zoomLevel]);

  // Time Updates
  const handleTimeUpdate = () => {
    if(videoRef.current) {
        setCurrentTime(videoRef.current.currentTime);
        if(isActive && onTimeUpdate) onTimeUpdate(videoRef.current.currentTime, videoRef.current.duration);
    }
  };
  const handleLoadedMetadata = () => { if(videoRef.current) setDuration(videoRef.current.duration); };

  const handleScrub = (e) => {
      const time = parseFloat(e.target.value);
      if (videoRef.current) {
          videoRef.current.currentTime = time;
          setCurrentTime(time);
      }
      if (isSynced && onScrub) {
          onScrub(time); 
      }
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const vid = videoRef.current;
    if (!canvas || !container) return;

    if (canvas.width !== container.clientWidth || canvas.height !== container.clientHeight) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    // Video Position for Blur
    let vDrawX = 0, vDrawY = 0, vDrawW = canvas.width, vDrawH = canvas.height;
    if (vid && vid.videoWidth) {
        const rVid = vid.videoWidth / vid.videoHeight;
        const rCan = canvas.width / canvas.height;
        if (rCan > rVid) { vDrawH = canvas.height; vDrawW = vDrawH * rVid; vDrawX = (canvas.width - vDrawW) / 2; } 
        else { vDrawW = canvas.width; vDrawH = vDrawW / rVid; vDrawY = (canvas.height - vDrawH) / 2; }
    }
    
    ctx.save();
    const centerX = container.clientWidth / 2; const centerY = container.clientHeight / 2;
    ctx.translate(panX, panY); ctx.translate(centerX, centerY); ctx.scale(zoomLevel, zoomLevel); ctx.translate(-centerX, -centerY);

    const renderShape = (shape) => {
      ctx.save();
      ctx.strokeStyle = shape.color; ctx.lineWidth = shape.width / zoomLevel; ctx.beginPath();
      if (shape.type === 'line') { ctx.moveTo(shape.start.x, shape.start.y); ctx.lineTo(shape.end.x, shape.end.y); ctx.stroke(); }
      else if (shape.type === 'rect') { ctx.strokeRect(shape.start.x, shape.start.y, shape.end.x - shape.start.x, shape.end.y - shape.start.y); }
      else if (shape.type === 'circle') { const r = Math.sqrt(Math.pow(shape.end.x - shape.start.x, 2) + Math.pow(shape.end.y - shape.start.y, 2)); ctx.beginPath(); ctx.arc(shape.start.x, shape.start.y, r, 0, 2 * Math.PI); ctx.stroke(); }
      else if (shape.type === 'blur') {
        const cX = (shape.start.x + shape.end.x) / 2; const cY = (shape.start.y + shape.end.y) / 2;
        const rX = Math.abs(shape.end.x - shape.start.x) / 2; const rY = Math.abs(shape.end.y - shape.start.y) / 2;
        ctx.beginPath(); ctx.ellipse(cX, cY, rX, rY, 0, 0, 2 * Math.PI);
        ctx.clip(); ctx.filter = 'blur(12px)';
        try { if (vid) ctx.drawImage(vid, vDrawX, vDrawY, vDrawW, vDrawH); } catch(e){}
        ctx.filter = 'none'; ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; ctx.lineWidth = 1 / zoomLevel; ctx.stroke();
      }
      else if (shape.type === 'free' && shape.points.length > 0) { ctx.moveTo(shape.points[0].x, shape.points[0].y); shape.points.forEach(p => ctx.lineTo(p.x, p.y)); ctx.stroke(); }
      else if (shape.type === 'angle') {
        ctx.fillStyle = shape.color; ctx.beginPath(); ctx.arc(shape.p1.x, shape.p1.y, 4 / zoomLevel, 0, Math.PI * 2); ctx.fill();
        if (shape.p2) { ctx.moveTo(shape.p1.x, shape.p1.y); ctx.lineTo(shape.p2.x, shape.p2.y); }
        if (shape.p3) { ctx.moveTo(shape.p1.x, shape.p1.y); ctx.lineTo(shape.p3.x, shape.p3.y); }
        ctx.stroke();
        if (shape.p2 && shape.p3) {
           const ang = calculateAngle(shape.p1, shape.p2, shape.p3);
           ctx.font = `bold ${14/zoomLevel}px sans-serif`; ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillText(`${ang}°`, shape.p1.x + 10, shape.p1.y + 20);
        }
      }
      ctx.restore();
    };
    shapes.forEach(renderShape);
    if (currentShape) renderShape(currentShape);
    if (tool === 'angle' && points.length > 0) { ctx.fillStyle = color; points.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 4/zoomLevel, 0, Math.PI*2); ctx.fill(); }); }
    ctx.restore();
  }, [shapes, currentShape, points, tool, color, lineWidth, zoomLevel, panX, panY]);

  useEffect(() => { const anim = requestAnimationFrame(draw); return () => cancelAnimationFrame(anim); }, [draw]);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left; const clientY = e.clientY - rect.top;
    const centerX = rect.width / 2; const centerY = rect.height / 2;
    return { x: (clientX - panX - centerX) / zoomLevel + centerX, y: (clientY - panY - centerY) / zoomLevel + centerY };
  };

  const handleMouseDown = (e) => {
    onActivate();
    if (!src) return;
    if (tool === 'move' && zoomLevel > 1.0) { isPanning.current = true; return; }
    if (tool === 'move') return;
    const pos = getPos(e);
    if (tool === 'angle') {
        const newPoints = [...points, pos]; setPoints(newPoints);
        if (newPoints.length === 3) { setShapes([...shapes, { type: 'angle', p1: newPoints[0], p2: newPoints[1], p3: newPoints[2], color, width: lineWidth }]); setPoints([]); }
        return;
    }
    setIsDrawing(true);
    if (tool === 'free') setCurrentShape({ type: 'free', points: [pos], color, width: lineWidth });
    else setCurrentShape({ type: tool, start: pos, end: pos, color, width: lineWidth });
  };

  const handleMouseMove = (e) => {
    if (isPanning.current) {
        setPanX(prev => prev + e.movementX); setPanY(prev => prev + e.movementY); return;
    }
    if (!isDrawing) return;
    const pos = getPos(e);
    if (tool === 'free') setCurrentShape(prev => ({ ...prev, points: [...prev.points, pos] }));
    else setCurrentShape(prev => ({ ...prev, end: pos }));
  };

  const handleMouseUp = () => { isPanning.current = false; if (!isDrawing) return; setIsDrawing(false); if (currentShape) { setShapes([...shapes, currentShape]); setCurrentShape(null); } };

  return (
    <div ref={containerRef} className={`relative w-full h-full flex flex-col items-center justify-center overflow-hidden bg-black ${isActive ? 'ring-2 ring-purple-500 z-10' : 'border-r border-gray-800'}`}>
      <div className="relative flex-1 w-full h-full overflow-hidden cursor-crosshair" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onMouseDown={handleMouseDown}>
          {!src && (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 gap-4">
                 <label className="cursor-pointer hover:text-purple-400 transition-colors flex flex-col items-center">
                    <Upload size={48} className="mb-2 opacity-50" />
                    <p className="text-lg font-medium">Upload File</p>
                    <input type="file" accept="video/*" className="hidden" onChange={onUpload} />
                 </label>
                 <div className="flex items-center gap-2 text-sm opacity-50"><span>or</span></div>
                 <button onClick={onUrlUpload} className="flex items-center gap-2 hover:text-purple-400 transition-colors"><Globe size={24} /><span className="font-medium">Load from URL</span></button>
              </div>
          )}
          {src && (
            <>
              <video ref={videoRef} src={src} crossOrigin="anonymous" style={{transform: `translate(${panX}px, ${panY}px) scale(${zoomLevel})`}} className="w-full h-full object-contain pointer-events-none" playsInline loop muted onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleLoadedMetadata} />
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
              <button 
                onClick={(e) => { e.stopPropagation(); onClear(); }}
                className="absolute top-4 right-4 z-50 p-2 bg-black/50 hover:bg-red-600 text-white rounded-full transition-colors"
                title="Clear Video"
              >
                <X size={20} />
              </button>
            </>
          )}
      </div>

      {src && (
          <div className="w-full bg-gray-900 px-4 py-2 border-t border-gray-800 flex items-center gap-2 z-20 shrink-0">
             <span className="text-xs font-mono text-gray-400 w-10 text-right">{currentTime.toFixed(1)}s</span>
             <input 
                type="range" 
                min="0" 
                max={duration || 100} 
                step="0.01"
                value={currentTime} 
                onChange={handleScrub}
                className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
             />
             <span className="text-xs font-mono text-gray-400 w-10">{duration.toFixed(1)}s</span>
          </div>
      )}
    </div>
  );
});

// --- Main App Shell ---
export default function Swingstr() {
  const [view, setView] = useState('analyze'); 
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [layout, setLayout] = useState('split'); 
  const [sync, setSync] = useState(false);
  const [activeScreen, setActiveScreen] = useState('left'); 
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [leftVideo, setLeftVideo] = useState(null);
  const [rightVideo, setRightVideo] = useState(null);
  const [zooms, setZooms] = useState({ left: 1.0, right: 1.0 });

  // Global Scrubber State
  const [globalTime, setGlobalTime] = useState(0);
  const [globalDuration, setGlobalDuration] = useState(0);

  // Load students from LocalStorage or default
  const [students, setStudents] = useState(() => {
      const saved = localStorage.getItem('swingstr_students');
      return saved ? JSON.parse(saved) : [ { id: 1, name: "Demo Student", email: "demo@golf.com", phone: "555-0123", videos: [], notes: "Working on takeaway path." } ];
  });

  // Auto-Save Effect
  useEffect(() => {
      localStorage.setItem('swingstr_students', JSON.stringify(students));
  }, [students]);

  const [saveData, setSaveData] = useState({ studentId: '', label: '' });
  const [editingStudent, setEditingStudent] = useState(null);

  // Tools & Menus
  const [tool, setTool] = useState('move');
  const [color, setColor] = useState('#ef4444');
  const [lineWidth, setLineWidth] = useState(3);
  const [speed, setSpeed] = useState(1.0);
  const [activeMenu, setActiveMenu] = useState(null); // 'tools', 'style', 'speed'

  const leftRef = useRef();
  const rightRef = useRef();

  // --- Upload Handlers ---
  const handleUpload = (side, e) => { if (e.target.files[0]) { const url = URL.createObjectURL(e.target.files[0]); if (side === 'left') setLeftVideo(url); else setRightVideo(url); } };
  const handleUrlUpload = (side) => {
    const url = prompt("Enter Direct Video URL (mp4/mov):");
    if (url) { if (side === 'left') setLeftVideo(url); else setRightVideo(url); }
  };
  
  const handleClearVideo = (side) => {
      if (side === 'left') setLeftVideo(null);
      else setRightVideo(null);
      if (activeScreen === side) {
          setGlobalTime(0);
          setGlobalDuration(0);
          setIsPlaying(false);
      }
  };

  // --- Controls ---
  const adjustZoom = (delta) => { setZooms(prev => { const current = prev[activeScreen]; const newVal = Math.max(1.0, Math.min(4.0, current + delta)); return { ...prev, [activeScreen]: newVal }; }); };
  
  const togglePlay = () => {
    const newState = !isPlaying;
    setIsPlaying(newState);
    if (sync) { newState ? (leftRef.current?.play(), rightRef.current?.play()) : (leftRef.current?.pause(), rightRef.current?.pause()); } 
    else { const target = activeScreen === 'left' ? leftRef : rightRef; newState ? target.current?.play() : target.current?.pause(); }
  };

  const seek = (amount) => {
    if (sync) { leftRef.current?.seekRelative(amount); rightRef.current?.seekRelative(amount); } 
    else { const target = activeScreen === 'left' ? leftRef : rightRef; target.current?.seekRelative(amount); }
  };

  const changeSpeed = (newSpeed) => {
    setSpeed(newSpeed); leftRef.current?.setPlaybackRate(newSpeed); rightRef.current?.setPlaybackRate(newSpeed);
  };

  const clearShapes = () => { const target = activeScreen === 'left' ? leftRef : rightRef; target.current?.clearShapes(); };

  const handleSnapshot = async () => {
    const target = activeScreen === 'left' ? leftRef : rightRef;
    if (target.current) {
        const dataUrl = await target.current.getSnapshot();
        if (dataUrl) { const link = document.createElement('a'); link.download = `swingstr-${Date.now()}.jpg`; link.href = dataUrl; link.click(); }
    }
  };

  // --- Sync Logic ---
  const handleTimeUpdate = (time, dur) => {
      setGlobalTime(time);
      setGlobalDuration(dur);
  };

  const handleLinkedScrub = (time) => {
      if (sync) {
          leftRef.current?.seekTo(time);
          rightRef.current?.seekTo(time);
      }
  };

  const handleGlobalScrub = (e) => {
      const t = parseFloat(e.target.value);
      setGlobalTime(t);
      if(sync) { leftRef.current?.seekTo(t); rightRef.current?.seekTo(t); }
      else {
          if(activeScreen === 'left') leftRef.current?.seekTo(t);
          else rightRef.current?.seekTo(t);
      }
  };

  // --- Student & Save Logic ---
  const openSaveModal = () => setShowSaveModal(true);
  const saveToStudent = () => {
    if (!saveData.studentId || !saveData.label) return;
    const targetVideo = activeScreen === 'left' ? leftVideo : rightVideo;
    if (targetVideo) {
        const newVideo = { id: Date.now(), label: saveData.label, date: new Date().toLocaleDateString(), url: targetVideo };
        setStudents(prev => prev.map(s => s.id === parseInt(saveData.studentId) ? { ...s, videos: [...(s.videos || []), newVideo] } : s));
        setShowSaveModal(false);
        setSaveData({ studentId: '', label: '' });
        alert("Saved!");
    }
  };
  const deleteStudent = (id) => { if(confirm("Delete student?")) setStudents(students.filter(s => s.id !== id)); };
  const saveEditedStudent = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const updated = { ...editingStudent, name: formData.get('name'), email: formData.get('email'), phone: formData.get('phone') };
    setStudents(students.map(s => s.id === editingStudent.id ? updated : s));
    setEditingStudent(null);
  };
  const handleUpdateNotes = (id, text) => { setStudents(students.map(s => s.id === id ? { ...s, notes: text } : s)); };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); seek(-0.05); } 
      else if (e.key === 'ArrowRight') { e.preventDefault(); seek(0.05); } 
      else if (e.key === ' ') { e.preventDefault(); togglePlay(); }
    };
    window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sync, activeScreen, isPlaying]); 

  // --- Popup Menu Content ---
  const ToolMenu = () => (
      <div className="absolute bottom-16 left-4 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl p-2 flex flex-col gap-2 w-48 z-50">
          <div className="text-xs font-bold text-gray-500 px-2 mb-1 uppercase tracking-wider">Drawing</div>
          <div className="grid grid-cols-4 gap-1">
            <IconButton onClick={() => {setTool('line'); setActiveMenu(null)}} active={tool === 'line'} title="Line"><Minus size={18} className="rotate-45"/></IconButton>
            <IconButton onClick={() => {setTool('angle'); setActiveMenu(null)}} active={tool === 'angle'} title="Angle"><span className="font-bold text-sm">∠</span></IconButton>
            <IconButton onClick={() => {setTool('circle'); setActiveMenu(null)}} active={tool === 'circle'} title="Circle"><CircleIcon size={18}/></IconButton>
            <IconButton onClick={() => {setTool('rect'); setActiveMenu(null)}} active={tool === 'rect'} title="Box"><Square size={18}/></IconButton>
            <IconButton onClick={() => {setTool('free'); setActiveMenu(null)}} active={tool === 'free'} title="Freehand"><Edit2 size={18}/></IconButton>
          </div>
          <div className="h-px bg-gray-700 my-1"></div>
          <div className="text-xs font-bold text-gray-500 px-2 mb-1 uppercase tracking-wider">Privacy</div>
          <button onClick={() => {setTool('blur'); setActiveMenu(null)}} className={`flex items-center gap-3 p-2 rounded hover:bg-gray-700 w-full ${tool === 'blur' ? 'text-purple-400' : 'text-gray-300'}`}>
            <EyeOff size={18} /> <span className="text-sm">Face Blur</span>
          </button>
      </div>
  );

  const StyleMenu = () => (
      <div className="absolute bottom-16 left-32 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl p-4 w-64 z-50">
          <div className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">Stroke Color</div>
          <div className="flex gap-2 mb-4">
            {['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ffffff'].map(c => (
                <button key={c} onClick={() => setColor(c)} className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${color === c ? 'border-white scale-110 ring-2 ring-purple-500' : 'border-transparent'}`} style={{backgroundColor: c}} />
            ))}
          </div>
          <div className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Thickness</div>
          <div className="flex items-center gap-3">
             <div className="h-1 bg-white rounded" style={{width: Math.max(2, lineWidth * 2) + 'px'}}></div>
             <input type="range" min="1" max="10" value={lineWidth} onChange={(e) => setLineWidth(parseInt(e.target.value))} className="flex-1 accent-purple-500 h-1 bg-gray-600 rounded-lg cursor-pointer" />
          </div>
      </div>
  );

  const SpeedMenu = () => (
      <div className="absolute bottom-16 right-40 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl p-2 flex flex-col gap-1 w-32 z-50">
          <div className="text-xs font-bold text-gray-500 px-2 mb-1 uppercase tracking-wider">Playback Speed</div>
          {[0.25, 0.5, 0.75, 1.0, 1.5, 2.0].map(r => (
             <button 
                key={r} 
                onClick={() => { changeSpeed(r); setActiveMenu(null); }} 
                className={`flex items-center justify-between px-3 py-2 rounded hover:bg-gray-700 text-sm ${speed === r ? 'bg-purple-900/50 text-purple-400 font-bold' : 'text-gray-300'}`}
             >
                <span>{r}x</span>
                {speed === r && <div className="w-2 h-2 rounded-full bg-purple-500"></div>}
             </button>
          ))}
      </div>
  );


  if (view === 'library') {
    return (
        <div className="h-screen w-screen bg-gray-900 text-gray-100 flex flex-col font-sans relative">
            {editingStudent && (
                <div className="absolute inset-0 z-[100] bg-black/70 flex items-center justify-center">
                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 w-96 shadow-2xl">
                        <h3 className="font-bold text-lg mb-4">Edit Profile</h3>
                        <form onSubmit={saveEditedStudent} className="space-y-4">
                            <input name="name" defaultValue={editingStudent.name} placeholder="Name" className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2" />
                            <input name="email" defaultValue={editingStudent.email} placeholder="Email" className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2" />
                            <input name="phone" defaultValue={editingStudent.phone} placeholder="Phone" className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2" />
                            <button type="submit" className="w-full bg-purple-600 py-2 rounded font-bold hover:bg-purple-500">Save Changes</button>
                        </form>
                        <button onClick={() => setEditingStudent(null)} className="mt-2 w-full text-gray-400 hover:text-white text-sm">Cancel</button>
                    </div>
                </div>
            )}
            <header className="h-16 border-b border-gray-800 flex items-center px-6 justify-between bg-gray-800">
                <div className="flex items-center gap-3">
                    <img src="/swingstr-logo.jpg" alt="Swingstr" className="h-10 w-10 rounded-full border-2 border-purple-500 object-cover" onError={(e) => { e.target.style.display='none'; }} />
                    <h1 className="text-xl font-bold tracking-tight">Student Library</h1>
                </div>
                <Button onClick={() => setView('analyze')}>Back to Analyzer</Button>
            </header>
            <div className="flex-1 overflow-auto p-8">
                <div className="max-w-5xl mx-auto">
                    <div className="bg-gray-800 p-6 rounded-xl mb-8 border border-gray-700">
                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><UserPlus size={20}/> Add New Student</h2>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.target);
                            const newStudent = { id: Date.now(), name: formData.get('name'), email: formData.get('email'), phone: formData.get('phone'), videos: [], notes: "" };
                            setStudents([...students, newStudent]);
                            e.target.reset();
                        }} className="flex gap-4">
                            <input name="name" placeholder="Name" required className="bg-gray-900 border border-gray-700 rounded px-4 py-2 flex-1" />
                            <input name="email" placeholder="Email" className="bg-gray-900 border border-gray-700 rounded px-4 py-2 flex-1" />
                            <input name="phone" placeholder="Phone" className="bg-gray-900 border border-gray-700 rounded px-4 py-2 flex-1" />
                            <button type="submit" className="bg-purple-600 px-6 py-2 rounded hover:bg-purple-500 font-bold">Add</button>
                        </form>
                    </div>
                    <div className="grid gap-6">
                        {students.map(student => (
                            <div key={student.id} className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 flex flex-col">
                                <div className="p-4 bg-gray-700/50 flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-lg">{student.name}</h3>
                                        <p className="text-sm text-gray-400">{student.email} • {student.phone}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => setEditingStudent(student)} className="p-2 bg-gray-600 hover:bg-gray-500 rounded"><Pencil size={16} /></button>
                                        <button onClick={() => deleteStudent(student.id)} className="p-2 bg-red-900/50 hover:bg-red-600 rounded text-red-200"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                                <div className="px-4 pt-4">
                                    <div className="flex items-center gap-2 mb-2 text-sm text-gray-400"><StickyNote size={14} /> <span>Coach's Notes</span></div>
                                    <textarea className="w-full bg-gray-900 border border-gray-700 rounded p-3 text-sm text-gray-300 focus:border-purple-500 outline-none transition-colors resize-none h-24" placeholder="Add notes..." value={student.notes || ''} onChange={(e) => handleUpdateNotes(student.id, e.target.value)} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-gray-900 text-gray-100 flex flex-col font-sans relative" onClick={() => setActiveMenu(null)}>
      
      {/* Save Modal */}
      {showSaveModal && (
          <div className="absolute inset-0 z-[100] bg-black/70 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
              <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 w-96 shadow-2xl">
                  <h3 className="font-bold text-lg mb-4">Save Video to Student</h3>
                  <div className="space-y-4">
                      <select className="w-full bg-gray-900 p-2 rounded border border-gray-600" onChange={(e) => setSaveData({...saveData, studentId: e.target.value})} value={saveData.studentId}>
                          <option value="">Select Student...</option>
                          {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <input className="w-full bg-gray-900 p-2 rounded border border-gray-600" placeholder="Label" value={saveData.label} onChange={(e) => setSaveData({...saveData, label: e.target.value})} />
                      <div className="flex gap-2">
                        <button onClick={() => setShowSaveModal(false)} className="flex-1 py-2 rounded text-gray-400 hover:text-white">Cancel</button>
                        <button onClick={saveToStudent} className="flex-1 bg-purple-600 py-2 rounded font-bold hover:bg-purple-500">Save</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Popups */}
      <div onClick={(e) => e.stopPropagation()}>
         {activeMenu === 'tools' && <ToolMenu />}
         {activeMenu === 'style' && <StyleMenu />}
         {activeMenu === 'speed' && <SpeedMenu />}
      </div>

      <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4 shrink-0 z-20">
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-3">
                <img src="/swingstr-logo.jpg" alt="Swingstr" className="h-10 w-10 rounded-full border-2 border-purple-500 object-cover" onError={(e) => { e.target.style.display='none'; }} />
                <h1 className="font-bold text-lg tracking-tight text-white">Swing<span className="text-purple-500">str</span></h1>
           </div>
           <button onClick={() => setView('library')} className="text-xs bg-gray-800 px-3 py-1.5 rounded-full hover:bg-gray-700 flex items-center gap-1 border border-gray-700"><Users size={12}/> Student Library</button>
        </div>
        <div className="flex items-center gap-4">
            <div className="flex bg-gray-800 rounded-lg p-1">
                <button onClick={() => { setLayout('single'); setActiveScreen('left'); }} className={`p-1.5 rounded ${layout === 'single' ? 'bg-gray-600 text-white' : 'text-gray-400'}`}><Maximize size={18} /></button>
                <button onClick={() => setLayout('split')} className={`p-1.5 rounded ${layout === 'split' ? 'bg-gray-600 text-white' : 'text-gray-400'}`}><SplitSquareHorizontal size={18} /></button>
            </div>
            {layout === 'split' && (
                <button onClick={() => setSync(!sync)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${sync ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>{sync ? <LinkIcon size={16} /> : <Link2Off size={16} />} {sync ? 'Linked' : 'Unlinked'}</button>
            )}
        </div>
        <div className="flex items-center gap-2">
           <Button onClick={() => adjustZoom(-0.2)}><ZoomOut size={18} /></Button>
           <span className="w-12 text-center font-mono text-sm text-purple-400 font-bold">{zooms[activeScreen].toFixed(1)}x</span>
           <Button onClick={() => adjustZoom(0.2)}><ZoomIn size={18} /></Button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden bg-black relative">
         <div className={`h-full relative flex flex-col ${layout === 'split' ? 'w-1/2' : 'w-full'} ${activeScreen === 'left' ? 'z-10' : 'z-0'}`}>
            {activeScreen === 'left' && <div className="absolute top-4 left-4 bg-purple-600 text-xs font-bold px-2 py-1 rounded z-20 pointer-events-none">ACTIVE</div>}
            <VideoCanvas 
                ref={leftRef} src={leftVideo} 
                tool={tool} color={color} lineWidth={lineWidth} playbackRate={speed} zoomLevel={zooms.left} 
                isActive={activeScreen === 'left'} 
                onActivate={() => setActiveScreen('left')} onUpload={(e) => handleUpload('left', e)} onUrlUpload={() => handleUrlUpload('left')} onClear={() => handleClearVideo('left')}
                isSynced={sync} onScrub={handleLinkedScrub} onTimeUpdate={handleTimeUpdate}
            />
         </div>

         {layout === 'split' && (
             <div className={`h-full flex flex-col border-l border-gray-800 relative ${activeScreen === 'right' ? 'z-10' : 'z-0'} w-1/2`}>
                {activeScreen === 'right' && <div className="absolute top-4 left-4 bg-purple-600 text-xs font-bold px-2 py-1 rounded z-20 pointer-events-none">ACTIVE</div>}
                <VideoCanvas 
                    ref={rightRef} src={rightVideo} 
                    tool={tool} color={color} lineWidth={lineWidth} playbackRate={speed} zoomLevel={zooms.right} 
                    isActive={activeScreen === 'right'} 
                    onActivate={() => setActiveScreen('right')} onUpload={(e) => handleUpload('right', e)} onUrlUpload={() => handleUrlUpload('right')} onClear={() => handleClearVideo('right')}
                    isSynced={sync} onScrub={handleLinkedScrub} onTimeUpdate={handleTimeUpdate}
                />
             </div>
         )}
      </main>

      <footer className="bg-gray-800 border-t border-gray-700 flex flex-col shrink-0 z-30">
         
         {/* Global Scrubber */}
         <div className="w-full px-4 pt-2 pb-1 flex items-center gap-3 border-b border-gray-700 bg-gray-850">
             <span className="text-xs font-mono text-gray-400 w-12 text-right">{globalTime.toFixed(1)}s</span>
             <input 
                type="range" 
                min="0" max={globalDuration || 100} step="0.01" 
                value={globalTime} onChange={handleGlobalScrub}
                className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400"
             />
             <span className="text-xs font-mono text-gray-400 w-12">{globalDuration.toFixed(1)}s</span>
         </div>

         {/* Controls Bar */}
         <div className="flex items-center justify-between px-4 py-2 h-14">
             {/* Tool Groups */}
             <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <IconButton onClick={() => setTool('move')} active={tool === 'move'} title="Move/Pan"><MousePointer2 size={20}/></IconButton>
                <div className="w-px h-8 bg-gray-700 mx-1"></div>
                
                <MenuButton 
                    icon={PenTool} label="Drawing" 
                    active={['line','angle','circle','rect','free','blur'].includes(tool)} 
                    isOpen={activeMenu === 'tools'}
                    onClick={() => setActiveMenu(activeMenu === 'tools' ? null : 'tools')} 
                />
                
                <MenuButton 
                    icon={Palette} label="Style" 
                    active={false} 
                    isOpen={activeMenu === 'style'}
                    onClick={() => setActiveMenu(activeMenu === 'style' ? null : 'style')} 
                />

                <div className="w-px h-8 bg-gray-700 mx-1"></div>
                <IconButton onClick={clearShapes} title="Clear All" className="text-red-400 hover:bg-red-900/30"><Trash2 size={20}/></IconButton>
             </div>

             {/* Playback */}
             <div className="flex items-center gap-4 absolute left-1/2 -translate-x-1/2">
                <button onClick={() => seek(-0.05)} className="text-gray-400 hover:text-white"><ChevronLeft size={28} /></button>
                <button onClick={togglePlay} className="bg-purple-600 text-white p-2 rounded-full hover:bg-purple-500 shadow-lg active:scale-95">
                    {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                </button>
                <button onClick={() => seek(0.05)} className="text-gray-400 hover:text-white"><ChevronRight size={28} /></button>
             </div>

             {/* Actions */}
             <div className="flex items-center gap-2">
                {/* Speed Menu Button */}
                <MenuButton 
                    icon={Gauge} label={`${speed}x`}
                    active={false}
                    isOpen={activeMenu === 'speed'}
                    onClick={() => setActiveMenu(activeMenu === 'speed' ? null : 'speed')} 
                />

                <IconButton onClick={handleSnapshot} title="Snapshot"><Camera size={20}/></IconButton>
                <IconButton onClick={openSaveModal} title="Save to Student" className="text-purple-400 hover:text-purple-200"><Save size={20}/></IconButton>
             </div>
         </div>
      </footer>
    </div>
  );
}