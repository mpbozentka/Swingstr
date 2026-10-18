const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('swingstrDesktop', {
  enabled: true,
  saveExport: (payload) => ipcRenderer.invoke('save-export', payload),
  onControlCommand: (callback) => {
    const listener = async (_event, command) => {
      try {
        const result = await callback(command.name, command.args)
        ipcRenderer.send('control-result', { id: command.id, result })
      } catch (error) {
        ipcRenderer.send('control-result', { id: command.id, error: error.message })
      }
    }
    ipcRenderer.on('control-command', listener)
    return () => ipcRenderer.removeListener('control-command', listener)
  },
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
