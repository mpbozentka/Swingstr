import React, { useState, useEffect, useCallback } from 'react';
import { Folder, Film, ChevronLeft, X, Loader2, HardDriveDownload } from 'lucide-react';
import { useGoogleDrive, parseDriveFolderId } from '../hooks/useGoogleDrive';
import { useEscapeClose } from '../hooks/useEscapeClose';

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const LS_HOME_KEY = 'swingstr_drive_home';

function formatSize(bytes) {
  if (!bytes) return '';
  const mb = Number(bytes) / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(Number(bytes) / 1024).toFixed(0)} KB`;
}

export default function DrivePickerModal({
  open,
  accessToken,
  onLoadVideo,
  onClose,
  initialFolderId = null,
}) {
  useEscapeClose(open, onClose);

  const { listFolder, streamFile } = useGoogleDrive(accessToken);

  const [folderInput, setFolderInput] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [folderStack, setFolderStack] = useState([]);
  const [items, setItems] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState(null);
  const [downloading, setDownloading] = useState(null); // fileId being downloaded

  const currentFolderId = folderStack.length > 0 ? folderStack[folderStack.length - 1].id : null;

  const loadFolder = useCallback(async (id, name) => {
    setListLoading(true);
    setListError(null);
    setShowInput(false);
    try {
      const files = await listFolder(id);
      setItems(files);
      setFolderStack((prev) => [...prev, { id, name }]);
      // Remember this as the home folder (only when browsing from the generic picker)
      if (!initialFolderId) {
        try { localStorage.setItem(LS_HOME_KEY, JSON.stringify({ id, name })); } catch {}
      }
    } catch (err) {
      setListError(err.message === 'SESSION_EXPIRED'
        ? 'Session expired — please sign out and sign in again.'
        : `Couldn't load folder: ${err.message}`);
    } finally {
      setListLoading(false);
    }
  }, [listFolder, initialFolderId]);

  // Auto-load on open: use initialFolderId (student folder), else try remembered home folder
  useEffect(() => {
    if (!open || folderStack.length > 0) return;
    const targetId = initialFolderId;
    const targetName = initialFolderId ? 'Student Folder' : null;
    if (targetId) {
      loadFolder(targetId, targetName);
      return;
    }
    // No initialFolderId — check for a remembered home folder
    try {
      const saved = localStorage.getItem(LS_HOME_KEY);
      if (saved) {
        const { id, name } = JSON.parse(saved);
        loadFolder(id, name);
        return;
      }
    } catch {}
    // Nothing saved — show the URL input
    setShowInput(true);
  }, [open, initialFolderId, folderStack.length, loadFolder]);

  // Reset state when closed
  useEffect(() => {
    if (!open) {
      setFolderInput('');
      setShowInput(false);
      setFolderStack([]);
      setItems([]);
      setListError(null);
      setDownloading(null);
    }
  }, [open]);

  const handleFolderSubmit = (e) => {
    e.preventDefault();
    const id = parseDriveFolderId(folderInput.trim());
    if (!id) {
      setListError('Paste a Google Drive folder URL or folder ID.');
      return;
    }
    loadFolder(id, 'Drive Folder');
  };

  const goBack = () => {
    setFolderStack((prev) => {
      const next = prev.slice(0, -1);
      if (next.length > 0) {
        const parent = next[next.length - 1];
        listFolder(parent.id).then(setItems).catch(() => {});
      } else {
        setItems([]);
      }
      return next;
    });
  };

  const handleLoadVideo = async (side, file) => {
    setDownloading(file.id + side);
    try {
      const blob = await streamFile(file.id);
      onLoadVideo(side, blob, file.id, file.name);
      onClose();
    } catch (err) {
      setListError(err.message === 'SESSION_EXPIRED'
        ? 'Session expired — please sign out and sign in again.'
        : `Download failed: ${err.message}`);
    } finally {
      setDownloading(null);
    }
  };

  if (!open) return null;

  const folders = items.filter((f) => f.mimeType === FOLDER_MIME);
  const videos = items.filter((f) => f.mimeType !== FOLDER_MIME);

  const crumb = folderStack.length > 0
    ? folderStack.map((f) => f.name).join(' / ')
    : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Browse Google Drive"
      className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 shrink-0">
          <div className="flex items-center gap-2">
            {folderStack.length > 0 && (
              <button
                onClick={goBack}
                aria-label="Go back"
                className="p-1 hover:bg-gray-700 rounded"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            <div>
              <h3 className="font-bold text-base">Google Drive</h3>
              {crumb && (
                <p className="text-xs text-gray-400 truncate max-w-[280px]">{crumb}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!initialFolderId && folderStack.length > 0 && !showInput && (
              <button
                onClick={() => {
                  setFolderStack([]);
                  setItems([]);
                  setShowInput(true);
                }}
                className="text-xs text-gray-500 hover:text-gray-300"
              >
                Change folder
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-1 hover:bg-gray-700 rounded"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-5 py-4">
          {/* Folder URL input — shown first time or when user wants to change */}
          {showInput && (
            <form onSubmit={handleFolderSubmit} className="mb-4">
              <label className="text-sm text-gray-400 block mb-2">
                Paste a Google Drive folder URL or ID
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={folderInput}
                  onChange={(e) => setFolderInput(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="flex-1 bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm focus:border-purple-500 outline-none"
                  autoFocus
                />
                <button
                  type="submit"
                  className="bg-purple-600 px-4 py-2 rounded text-sm font-medium hover:bg-purple-500"
                >
                  Open
                </button>
              </div>
            </form>
          )}

          {listError && (
            <p className="text-red-400 text-sm mb-3">{listError}</p>
          )}

          {listLoading && (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 size={28} className="animate-spin" />
            </div>
          )}

          {!listLoading && currentFolderId && (
            <>
              {folders.length === 0 && videos.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-8">No folders or videos found.</p>
              )}

              {/* Subfolders */}
              {folders.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Folders</p>
                  <div className="space-y-1">
                    {folders.map((folder) => (
                      <button
                        key={folder.id}
                        onClick={() => loadFolder(folder.id, folder.name)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-700 text-left"
                      >
                        <Folder size={18} className="text-yellow-400 shrink-0" />
                        <span className="text-sm truncate">{folder.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Videos */}
              {videos.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Videos</p>
                  <div className="space-y-2">
                    {videos.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-700/50 border border-gray-700"
                      >
                        <Film size={18} className="text-purple-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{file.name}</p>
                          {file.size && (
                            <p className="text-xs text-gray-500">{formatSize(file.size)}</p>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => handleLoadVideo('left', file)}
                            disabled={!!downloading}
                            title="Load into left screen"
                            className="flex items-center gap-1 px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs font-medium disabled:opacity-40"
                          >
                            {downloading === file.id + 'left' ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <HardDriveDownload size={12} />
                            )}
                            L
                          </button>
                          <button
                            onClick={() => handleLoadVideo('right', file)}
                            disabled={!!downloading}
                            title="Load into right screen"
                            className="flex items-center gap-1 px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs font-medium disabled:opacity-40"
                          >
                            {downloading === file.id + 'right' ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <HardDriveDownload size={12} />
                            )}
                            R
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
