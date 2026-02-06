import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { Upload, X, Globe } from 'lucide-react';
import { renderShape } from '../utils/shapeRenderer';
import { getHandlesForShape, hitTestHandle, hitTestShape, findShapeAtPos, updateShapeWithHandle } from '../utils/shapeEditing';

const VideoCanvas = forwardRef(
  (
    {
      src,
      tool,
      color,
      lineWidth,
      playbackRate,
      zoomLevel,
      isActive,
      onActivate,
      onUpload,
      onUrlUpload,
      onClear,
      isSynced,
      onScrub,
      onTimeUpdate,
    },
    ref
  ) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    const [panX, setPanX] = useState(0);
    const [panY, setPanY] = useState(0);
    const isPanning = useRef(false);
    const lastPointerPos = useRef({ x: 0, y: 0 });
    const [shapes, setShapes] = useState([]);
    const [currentShape, setCurrentShape] = useState(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [points, setPoints] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const draggingHandle = useRef(null);

    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const takeSnapshot = useCallback(async () => {
      if (!videoRef.current || !canvasRef.current || !containerRef.current)
        return null;
      const vid = videoRef.current;
      if (vid.videoWidth === 0) return null;

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = vid.videoWidth;
      tempCanvas.height = vid.videoHeight;
      const ctx = tempCanvas.getContext('2d');

      try {
        ctx.drawImage(vid, 0, 0, tempCanvas.width, tempCanvas.height);
      } catch (e) {
        console.warn('Snapshot: CORS or drawImage failed', e.message);
        return null;
      }

      const scaleX = vid.videoWidth / containerRef.current.clientWidth;
      const scaleY = vid.videoHeight / containerRef.current.clientHeight;
      const videoRect = { x: 0, y: 0, w: tempCanvas.width, h: tempCanvas.height };

      ctx.save();
      ctx.scale(scaleX, scaleY);
      shapes.forEach((s) => {
        renderShape(ctx, s, {
          zoomLevel,
          video: vid,
          videoRect,
          blurPx: 15,
        });
      });
      ctx.restore();

      return tempCanvas.toDataURL('image/jpeg', 0.9);
    }, [shapes, zoomLevel]);

    useImperativeHandle(
      ref,
      () => ({
        play: () => videoRef.current?.play().catch(() => { }),
        pause: () => videoRef.current?.pause(),
        seekRelative: (s) => {
          if (videoRef.current) videoRef.current.currentTime += s;
        },
        seekTo: (t) => {
          if (videoRef.current) videoRef.current.currentTime = t;
        },
        setPlaybackRate: (r) => {
          if (videoRef.current) videoRef.current.playbackRate = r;
        },
        clearShapes: () => {
          setShapes([]);
          setSelectedIndex(-1);
          draggingHandle.current = null;
        },
        getSnapshot: takeSnapshot,
        hasVideo: !!src,
        get currentTime() {
          return videoRef.current?.currentTime ?? 0;
        },
        get duration() {
          return videoRef.current?.duration ?? 0;
        },
      }),
      [takeSnapshot, src]
    );

    useEffect(() => {
      if (videoRef.current) videoRef.current.playbackRate = playbackRate;
    }, [playbackRate]);
    useEffect(() => {
      if (zoomLevel === 1.0) {
        setPanX(0);
        setPanY(0);
      }
    }, [zoomLevel]);

    const handleTimeUpdate = () => {
      if (videoRef.current) {
        setCurrentTime(videoRef.current.currentTime);
        if (isActive && onTimeUpdate) {
          onTimeUpdate(videoRef.current.currentTime, videoRef.current.duration);
        }
      }
    };
    const handleLoadedMetadata = () => {
      if (videoRef.current) setDuration(videoRef.current.duration);
    };

    const draw = useCallback(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      const vid = videoRef.current;
      if (!canvas || !container) return;

      if (
        canvas.width !== container.clientWidth ||
        canvas.height !== container.clientHeight
      ) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
      }
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      let vDrawX = 0,
        vDrawY = 0,
        vDrawW = canvas.width,
        vDrawH = canvas.height;
      if (vid?.videoWidth) {
        const rVid = vid.videoWidth / vid.videoHeight;
        const rCan = canvas.width / canvas.height;
        if (rCan > rVid) {
          vDrawH = canvas.height;
          vDrawW = vDrawH * rVid;
          vDrawX = (canvas.width - vDrawW) / 2;
        } else {
          vDrawW = canvas.width;
          vDrawH = vDrawW / rVid;
          vDrawY = (canvas.height - vDrawH) / 2;
        }
      }
      const videoRect = { x: vDrawX, y: vDrawY, w: vDrawW, h: vDrawH };

      ctx.save();
      const centerX = container.clientWidth / 2;
      const centerY = container.clientHeight / 2;
      ctx.translate(panX, panY);
      ctx.translate(centerX, centerY);
      ctx.scale(zoomLevel, zoomLevel);
      ctx.translate(-centerX, -centerY);

      shapes.forEach((shape) =>
        renderShape(ctx, shape, {
          zoomLevel,
          video: vid,
          videoRect,
        })
      );
      if (currentShape) {
        renderShape(ctx, currentShape, {
          zoomLevel,
          video: vid,
          videoRect,
        });
      }
      if (tool === 'angle' && points.length > 0) {
        ctx.fillStyle = color;
        points.forEach((p) => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4 / zoomLevel, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      if (selectedIndex >= 0 && selectedIndex < shapes.length) {
        const sel = shapes[selectedIndex];
        const handles = getHandlesForShape(sel, zoomLevel);
        ctx.fillStyle = 'rgba(99, 102, 241, 0.9)';
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2 / zoomLevel;
        handles.forEach((h) => {
          ctx.beginPath();
          ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
      }
      ctx.restore();
    }, [shapes, currentShape, points, tool, color, zoomLevel, panX, panY, selectedIndex]);

    useEffect(() => {
      const anim = requestAnimationFrame(draw);
      return () => cancelAnimationFrame(anim);
    }, [draw]);

    const getEventCoords = (e) => {
      if (e.touches?.[0]) {
        return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
      }
      if (e.changedTouches?.[0]) {
        return { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY };
      }
      return { clientX: e.clientX, clientY: e.clientY };
    };

    const getPos = (e) => {
      const rect = canvasRef.current.getBoundingClientRect();
      const { clientX, clientY } = getEventCoords(e);
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      return {
        x: (x - panX - centerX) / zoomLevel + centerX,
        y: (y - panY - centerY) / zoomLevel + centerY,
      };
    };

    const handlePointerDown = (e) => {
      if (e.pointerType === 'touch') {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      onActivate();
      if (!src) return;
      if (tool === 'move' && zoomLevel > 1.0) {
        isPanning.current = true;
        const { clientX, clientY } = getEventCoords(e);
        lastPointerPos.current = { x: clientX, y: clientY };
        return;
      }
      if (tool === 'move') return;
      const pos = getPos(e);
      if (selectedIndex >= 0 && selectedIndex < shapes.length) {
        const handleId = hitTestHandle(pos, shapes[selectedIndex], zoomLevel);
        if (handleId) {
          draggingHandle.current = { shapeIndex: selectedIndex, handleId };
          if (videoRef.current) videoRef.current.pause();
          return;
        }
        const idx = findShapeAtPos(pos, shapes, zoomLevel);
        if (idx >= 0) {
          setSelectedIndex(idx);
          return;
        }
        setSelectedIndex(-1);
      }
      if (tool === 'select') {
        const idx = findShapeAtPos(pos, shapes, zoomLevel);
        setSelectedIndex(idx);
        return;
      }
      if (videoRef.current) videoRef.current.pause();
      if (tool === 'angle') {
        const newPoints = [...points, pos];
        setPoints(newPoints);
        if (newPoints.length === 3) {
          const newShape = {
            type: 'angle',
            p1: newPoints[0],
            p2: newPoints[1],
            p3: newPoints[2],
            color,
            width: lineWidth,
          };
          setShapes((prev) => {
            const next = [...prev, newShape];
            setSelectedIndex(next.length - 1);
            return next;
          });
          setPoints([]);
        }
        return;
      }
      setIsDrawing(true);
      if (tool === 'free') {
        setCurrentShape({
          type: 'free',
          points: [pos],
          color,
          width: lineWidth,
        });
      } else {
        setCurrentShape({
          type: tool,
          start: pos,
          end: pos,
          color,
          width: lineWidth,
        });
      }
    };

    const handlePointerMove = (e) => {
      if (e.pointerType === 'touch') e.preventDefault();
      if (isPanning.current) {
        const { clientX, clientY } = getEventCoords(e);
        const dx = (e.movementX != null ? e.movementX : clientX - lastPointerPos.current.x);
        const dy = (e.movementY != null ? e.movementY : clientY - lastPointerPos.current.y);
        lastPointerPos.current = { x: clientX, y: clientY };
        setPanX((prev) => prev + dx);
        setPanY((prev) => prev + dy);
        return;
      }
      const dh = draggingHandle.current;
      if (dh !== null) {
        const pos = getPos(e);
        setShapes((prev) => {
          const next = [...prev];
          const shape = next[dh.shapeIndex];
          if (shape) {
            next[dh.shapeIndex] = updateShapeWithHandle(shape, dh.handleId, pos);
          }
          return next;
        });
        return;
      }
      if (!isDrawing) return;
      const pos = getPos(e);
      if (tool === 'free') {
        setCurrentShape((prev) => ({
          ...prev,
          points: [...prev.points, pos],
        }));
      } else {
        setCurrentShape((prev) => ({ ...prev, end: pos }));
      }
    };

    const handlePointerUp = () => {
      isPanning.current = false;
      if (draggingHandle.current !== null) {
        draggingHandle.current = null;
        return;
      }
      if (!isDrawing) return;
      setIsDrawing(false);
      if (currentShape) {
        setShapes((prev) => {
          const next = [...prev, currentShape];
          setSelectedIndex(next.length - 1);
          return next;
        });
        setCurrentShape(null);
      }
    };

    return (
      <div
        ref={containerRef}
        className={`relative w-full h-full flex flex-col items-center justify-center overflow-hidden bg-black ${isActive ? 'ring-2 ring-purple-500 z-10' : 'border-r border-gray-800'
          }`}
      >
        <div
          className="relative flex-1 w-full h-full overflow-hidden cursor-crosshair"
          style={{ touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {!src && (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 gap-4">
              <label className="cursor-pointer hover:text-purple-400 transition-colors flex flex-col items-center">
                <Upload size={48} className="mb-2 opacity-50" />
                <p className="text-lg font-medium">Upload File</p>
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={onUpload}
                />
              </label>
              <div className="flex items-center gap-2 text-sm opacity-50">
                <span>or</span>
              </div>
              <button
                onClick={onUrlUpload}
                className="flex items-center gap-2 hover:text-purple-400 transition-colors"
              >
                <Globe size={24} />
                <span className="font-medium">Load from URL</span>
              </button>
            </div>
          )}
          {src && (
            <>
              <video
                ref={videoRef}
                src={src}
                crossOrigin="anonymous"
                style={{
                  transform: `translate(${panX}px, ${panY}px) scale(${zoomLevel})`,
                }}
                className="w-full h-full object-contain pointer-events-none"
                playsInline
                loop
                muted
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                className="absolute top-4 right-4 z-50 p-2 bg-black/50 hover:bg-red-600 text-white rounded-full transition-colors"
                title="Clear Video"
              >
                <X size={20} />
              </button>
            </>
          )}
        </div>
      </div>
    );
  }
);

VideoCanvas.displayName = 'VideoCanvas';

export default VideoCanvas;
