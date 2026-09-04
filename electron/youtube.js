import { spawn } from 'node:child_process'
import { existsSync, readdirSync, unlinkSync } from 'node:fs'
import path from 'node:path'
import { isYouTubeUrl, extractYouTubeId } from '../src/utils/url.js'

const YT_DLP_CANDIDATES = [
  '/Library/Frameworks/Python.framework/Versions/3.13/bin/yt-dlp',
  '/opt/homebrew/bin/yt-dlp',
  '/usr/local/bin/yt-dlp',
]

const FFMPEG_CANDIDATES = [
  '/opt/homebrew/bin/ffmpeg',
  '/usr/local/bin/ffmpeg',
]

const EXTRA_PATH = [
  '/Library/Frameworks/Python.framework/Versions/3.13/bin',
  '/opt/homebrew/bin',
  '/usr/local/bin',
].join(':')

let current = null

function findBinary(candidates, name) {
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return name
}

const CLIP_EXTS = ['.mp4', '.mkv', '.webm', '.mov']

/**
 * A finished clip is exactly `<id>.<ext>`. Half-finished pieces yt-dlp leaves
 * behind — `<id>.f137.mp4` (video only), `<id>.f140.m4a` (audio only),
 * `<id>.mp4.part` — must never be mistaken for a completed download.
 */
function findExistingClip(dir, videoId) {
  if (!videoId || !existsSync(dir)) return null
  const match = readdirSync(dir).find((name) => (
    CLIP_EXTS.some((ext) => name === `${videoId}${ext}`)
  ))
  return match ? path.join(dir, match) : null
}

function parsePercent(line) {
  const match = line.match(/\[download\]\s+(\d{1,3}(?:\.\d+)?)%/)
  if (!match) return null
  return Math.max(0, Math.min(100, Number(match[1])))
}

/** Delete every half-finished piece for this video: `.part`, `.ytdl`, and per-stream fragments. */
function cleanupLeftovers(dir, videoId) {
  if (!videoId || !existsSync(dir)) return
  const escaped = videoId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const fragment = new RegExp(`^${escaped}\\.f\\d+\\.`)
  for (const name of readdirSync(dir)) {
    if (!name.startsWith(videoId)) continue
    if (name.endsWith('.part') || name.endsWith('.ytdl') || fragment.test(name)) {
      try { unlinkSync(path.join(dir, name)) } catch { /* ignore */ }
    }
  }
}

export { isYouTubeUrl }

export function cancelYouTubeDownload() {
  if (!current) return
  current.cancelled = true
  try { current.child.kill('SIGTERM') } catch { /* already gone */ }
}

export function downloadYouTubeClip({ url, outDir, onProgress }) {
  if (!isYouTubeUrl(url)) {
    return Promise.resolve({ error: 'Not a YouTube URL.' })
  }

  const ytDlp = findBinary(YT_DLP_CANDIDATES, 'yt-dlp')
  if (ytDlp !== 'yt-dlp' && !existsSync(ytDlp)) {
    return Promise.resolve({ error: 'yt-dlp is not installed. Swingstr uses it to pull YouTube clips.' })
  }

  const videoId = extractYouTubeId(url)
  const existing = findExistingClip(outDir, videoId)
  if (existing) {
    onProgress?.({ percent: 100, status: 'Already downloaded' })
    return Promise.resolve({ filePath: existing, fileName: path.basename(existing) })
  }

  if (current) {
    return Promise.resolve({ error: 'Already downloading a clip. Wait or cancel first.' })
  }

  const ffmpeg = findBinary(FFMPEG_CANDIDATES, '')
  const args = [
    '--no-playlist',
    '--no-overwrites',
    '--restrict-filenames',
    '--newline',
    '--no-warnings',
    '--match-filter', '!is_live',
    '--merge-output-format', 'mp4',
    '-f', 'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b',
    '-o', path.join(outDir, '%(id)s.%(ext)s'),
    url,
  ]
  if (ffmpeg && existsSync(ffmpeg)) {
    args.unshift('--ffmpeg-location', ffmpeg)
  }

  onProgress?.({ percent: 0, status: 'Starting YouTube download' })

  return new Promise((resolve) => {
    const child = spawn(ytDlp, args, {
      env: { ...process.env, PATH: `${EXTRA_PATH}:${process.env.PATH || ''}` },
    })
    current = { child, cancelled: false }

    let stderr = ''
    let maxPercent = 0
    // yt-dlp downloads video and audio as separate passes, each running 0→100%.
    // Map pass 1 onto 0-50% and pass 2 onto 50-90% so the bar never pins at 100
    // while there is still work left.
    let stage = 0
    let lastRaw = 0
    const onData = (chunk) => {
      const text = String(chunk)
      stderr += text
      for (const line of text.split('\n')) {
        const percent = parsePercent(line)
        if (percent != null) {
          if (percent + 20 < lastRaw) stage += 1
          lastRaw = percent
          const overall = stage === 0 ? percent * 0.5 : 50 + percent * 0.4
          maxPercent = Math.max(maxPercent, overall)
          onProgress?.({ percent: maxPercent, status: `Downloading ${Math.round(maxPercent)}%` })
        } else if (/Merging formats/i.test(line)) {
          maxPercent = Math.max(maxPercent, 95)
          onProgress?.({ percent: maxPercent, status: 'Finishing clip' })
        }
      }
    }

    child.stdout.on('data', onData)
    child.stderr.on('data', onData)

    child.on('error', (err) => {
      current = null
      if (err.code === 'ENOENT') {
        resolve({ error: 'yt-dlp is not installed. Swingstr uses it to pull YouTube clips.' })
        return
      }
      resolve({ error: err.message || "Couldn't start the YouTube download." })
    })

    child.on('close', (code) => {
      const cancelled = current?.cancelled
      current = null
      cleanupLeftovers(outDir, videoId)

      if (cancelled) {
        resolve({ error: 'Download cancelled.' })
        return
      }

      const filePath = findExistingClip(outDir, videoId)
      if (code === 0 && filePath) {
        onProgress?.({ percent: 100, status: 'Ready' })
        resolve({ filePath, fileName: path.basename(filePath) })
        return
      }

      const detail = stderr
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('[download]'))
        .pop()

      resolve({
        error: detail || `YouTube download failed (code ${code}).`,
      })
    })
  })
}
