import React from 'react';
import { Minus, Circle as CircleIcon, Square, Edit2, EyeOff } from 'lucide-react';
import { IconButton } from './ui/Button';

export default function ToolMenu({ tool, setTool, onClose }) {
  const setAndClose = (t) => {
    setTool(t);
    onClose();
  };
  return (
    <div className="absolute bottom-16 left-4 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl p-2 flex flex-col gap-2 w-48 z-50">
      <div className="text-xs font-bold text-gray-500 px-2 mb-1 uppercase tracking-wider">
        Drawing
      </div>
      <div className="grid grid-cols-4 gap-1">
        <IconButton
          onClick={() => setAndClose('line')}
          active={tool === 'line'}
          title="Line"
        >
          <Minus size={18} className="rotate-45" />
        </IconButton>
        <IconButton
          onClick={() => setAndClose('angle')}
          active={tool === 'angle'}
          title="Angle"
        >
          <span className="font-bold text-sm">∠</span>
        </IconButton>
        <IconButton
          onClick={() => setAndClose('circle')}
          active={tool === 'circle'}
          title="Circle"
        >
          <CircleIcon size={18} />
        </IconButton>
        <IconButton
          onClick={() => setAndClose('rect')}
          active={tool === 'rect'}
          title="Box"
        >
          <Square size={18} />
        </IconButton>
        <IconButton
          onClick={() => setAndClose('free')}
          active={tool === 'free'}
          title="Freehand"
        >
          <Edit2 size={18} />
        </IconButton>
      </div>
      <div className="h-px bg-gray-700 my-1" />
      <div className="text-xs font-bold text-gray-500 px-2 mb-1 uppercase tracking-wider">
        Privacy
      </div>
      <button
        onClick={() => setAndClose('blur')}
        className={`flex items-center gap-3 p-2 rounded hover:bg-gray-700 w-full ${tool === 'blur' ? 'text-purple-400' : 'text-gray-300'
          }`}
      >
        <EyeOff size={18} /> <span className="text-sm">Face Blur</span>
      </button>
    </div>
  );
}
