const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('swingstrDesktop', {
  enabled: true,
  libraryDir: () => ipcRenderer.sendSync('library-dir'),
  loadStudents: () => ipcRenderer.sendSync('load-students'),
  saveStudents: (payload) => ipcRenderer.invoke('save-students', payload),
  saveVideo: (videoId, buffer, ext, meta) => ipcRenderer.invoke('save-video', videoId, buffer, ext, meta),
  loadVideo: (videoId) => ipcRenderer.invoke('load-video', videoId),
  deleteVideo: (videoId) => ipcRenderer.invoke('delete-video', videoId),
  downloadYouTube: (url) => ipcRenderer.invoke('download-youtube', url),
  cancelYouTube: () => ipcRenderer.invoke('cancel-youtube'),
  onYouTubeProgress: (callback) => {
    const listener = (_event, data) => callback(data)
    ipcRenderer.on('youtube-progress', listener)
    return () => ipcRenderer.removeListener('youtube-progress', listener)
  },
})
