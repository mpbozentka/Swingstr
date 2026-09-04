import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { createServer } from 'node:http'
import { existsSync } from 'node:fs'
import { readFile, writeFile, readdir, unlink } from 'node:fs/promises'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cancelYouTubeDownload, downloadYouTubeClip } from './youtube.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DIST = path.join(ROOT, 'dist')
const PORT = 17832

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.task': 'application/octet-stream',
  '.map': 'application/json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
}

app.setName('Swingstr')
app.setPath('userData', path.join(app.getPath('appData'), 'Swingstr'))

function libraryDir() {
  return path.join(app.getPath('documents'), 'Swingstr Library')
}

function videosDir() {
  return path.join(libraryDir(), 'videos')
}

function youtubeDir() {
  return path.join(libraryDir(), 'youtube')
}

function studentsPath() {
  return path.join(libraryDir(), 'students.json')
}

// Videos live under videos/<Student Name>/<label>__<id>.<ext> so the folder is
// browsable in Finder. The id stays in the filename because that's the only
// thing the app looks a video up by — the readable half is for the human.
function safeSegment(value, fallback) {
  const cleaned = String(value ?? '')
    .replace(/[^a-zA-Z0-9 ._-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
  return cleaned || fallback
}

// Root plus one level of student folders — deep enough for the layout we
// write, shallow enough that a stray folder can't turn a lookup into a crawl.
async function videoFilePaths() {
  const out = []
  const entries = await readdir(videosDir(), { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isFile()) {
      out.push(path.join(videosDir(), entry.name))
    } else if (entry.isDirectory()) {
      const nested = await readdir(path.join(videosDir(), entry.name)).catch(() => [])
      for (const name of nested) out.push(path.join(videosDir(), entry.name, name))
    }
  }
  return out
}

async function findVideoFiles(videoId) {
  const id = String(videoId)
  const files = await videoFilePaths()
  return files.filter((full) => path.basename(full).includes(id))
}

function ensureLibrarySync() {
  mkdirSync(videosDir(), { recursive: true })
  mkdirSync(youtubeDir(), { recursive: true })
  const readme = path.join(libraryDir(), 'README.txt')
  if (!existsSync(readme)) {
    writeFileSync(
      readme,
      [
        'Swingstr Library',
        '',
        'students.json  — student names, notes, and saved-video list',
        'videos/        — swing videos, in a folder per student',
        'youtube/       — clips pulled from YouTube URLs',
        '',
        'This folder is created and used by the Swingstr desktop app.',
        'Deleting files here removes them from Swingstr.',
        '',
      ].join('\n')
    )
  }
}

function sendFile(res, filePath) {
  readFile(filePath)
    .then((buf) => {
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' })
      res.end(buf)
    })
    .catch((err) => {
      if (err.code === 'ENOENT') {
        res.writeHead(404)
        res.end('Not found')
        return
      }
      res.writeHead(500)
      res.end('Server error')
    })
}

let mainWindow = null
let server = null

function sendIndex(res) {
  const file = path.join(DIST, 'index.html')
  readFile(file)
    .then((buf) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(buf)
    })
    .catch(() => {
      res.writeHead(500, { 'Content-Type': 'text/plain' })
      res.end('Swingstr build is missing. Run npm run build in the project folder.')
    })
}

function startServer() {
  return new Promise((resolve, reject) => {
    server = createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0])

      if (urlPath.startsWith('/_library/')) {
        const libRoot = libraryDir()
        const relative = urlPath.slice('/_library/'.length)
        const filePath = path.normalize(path.join(libRoot, relative))
        const rel = path.relative(libRoot, filePath)
        if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
          res.writeHead(403)
          res.end()
          return
        }
        sendFile(res, filePath)
        return
      }

      const relative = urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, '')
      const filePath = path.normalize(path.join(DIST, relative))
      if (!filePath.startsWith(DIST)) {
        res.writeHead(403)
        res.end()
        return
      }
      readFile(filePath)
        .then((buf) => {
          res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' })
          res.end(buf)
        })
        .catch((err) => {
          if (err.code === 'ENOENT' && !path.extname(relative)) {
            sendIndex(res)
            return
          }
          if (err.code === 'ENOENT') {
            res.writeHead(404)
            res.end('Not found')
            return
          }
          res.writeHead(500)
          res.end('Server error')
        })
    })
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve()
        return
      }
      reject(err)
    })
    server.listen(PORT, '127.0.0.1', resolve)
  })
}

function createWindow() {
  const icon = path.join(ROOT, 'public', 'swingstr-icon.jpg')
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'Swingstr',
    backgroundColor: '#111827',
    icon,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(icon)
  }

  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const host = new URL(url).hostname
      if (host.endsWith('google.com') || host.endsWith('googleusercontent.com')) {
        return { action: 'allow' }
      }
    } catch {
      // fall through
    }
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.loadURL(`http://127.0.0.1:${PORT}`)
}

function registerIpc() {
  ipcMain.on('library-dir', (event) => {
    event.returnValue = libraryDir()
  })

  ipcMain.on('load-students', (event) => {
    try {
      ensureLibrarySync()
      if (!existsSync(studentsPath())) {
        event.returnValue = null
        return
      }
      event.returnValue = JSON.parse(readFileSync(studentsPath(), 'utf8'))
    } catch (err) {
      console.warn('[swingstr] failed to read students.json', err)
      event.returnValue = null
    }
  })

  ipcMain.handle('save-students', async (_event, payload) => {
    ensureLibrarySync()
    await writeFile(studentsPath(), JSON.stringify(payload, null, 2))
  })

  ipcMain.handle('save-video', async (_event, videoId, buffer, ext, meta) => {
    ensureLibrarySync()
    const safeId = String(videoId).replace(/[^a-zA-Z0-9._-]/g, '')
    const safeExt = /^\.[a-z0-9]+$/i.test(ext) ? ext.toLowerCase() : '.mp4'
    const folder = path.join(videosDir(), safeSegment(meta?.studentName, 'Unfiled'))
    mkdirSync(folder, { recursive: true })
    const label = safeSegment(meta?.label, '')
    const target = path.join(folder, `${label ? `${label}__` : ''}${safeId}${safeExt}`)
    await writeFile(target, Buffer.from(buffer))
    return target
  })

  ipcMain.handle('load-video', async (_event, videoId) => {
    ensureLibrarySync()
    const [match] = await findVideoFiles(videoId)
    if (!match) return null
    const buf = await readFile(match)
    return {
      buffer: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      name: path.basename(match),
    }
  })

  ipcMain.handle('delete-video', async (_event, videoId) => {
    ensureLibrarySync()
    const matches = await findVideoFiles(videoId)
    await Promise.all(matches.map((full) => unlink(full).catch(() => {})))
  })

  ipcMain.handle('download-youtube', async (event, url) => {
    ensureLibrarySync()
    const result = await downloadYouTubeClip({
      url,
      outDir: youtubeDir(),
      onProgress: (data) => {
        if (!event.sender.isDestroyed()) event.sender.send('youtube-progress', data)
      },
    })
    if (result?.error) return { error: result.error }
    return {
      playUrl: `http://127.0.0.1:${PORT}/_library/youtube/${encodeURIComponent(result.fileName)}`,
      fileName: result.fileName,
    }
  })

  ipcMain.handle('cancel-youtube', async () => {
    cancelYouTubeDownload()
  })
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.whenReady().then(async () => {
    if (!existsSync(path.join(DIST, 'index.html'))) {
      console.error('Swingstr dist/ is missing. Run npm run build first.')
    }
    ensureLibrarySync()
    registerIpc()
    await startServer()
    createWindow()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  app.on('window-all-closed', () => {
    if (server) {
      server.close()
      server = null
    }
    app.quit()
  })
}
