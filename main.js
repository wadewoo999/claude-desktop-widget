'use strict'

const { app, BrowserWindow, ipcMain, session, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

// ─── Simple JSON store (replaces electron-store, no third-party deps) ─────────
class JsonStore {
  constructor(defaults = {}) {
    // Store file in userData so it survives app updates
    this._file = path.join(app.getPath('userData'), 'settings.json')
    this._defaults = defaults
    try {
      this._data = JSON.parse(fs.readFileSync(this._file, 'utf8'))
    } catch (_) {
      this._data = {}
    }
  }
  get(key) {
    return key in this._data ? this._data[key] : this._defaults[key]
  }
  set(key, val) {
    this._data[key] = val
    try { fs.writeFileSync(this._file, JSON.stringify(this._data, null, 2)) } catch (_) {}
  }
  delete(key) {
    delete this._data[key]
    try { fs.writeFileSync(this._file, JSON.stringify(this._data, null, 2)) } catch (_) {}
  }
}

const LAYOUTS = {
  wide: { w: 500, h: 115 },
  tall: { w: 375, h: 170 },
}

const store = new JsonStore({
  x: null,
  y: null,
  layout: 'wide',
  theme: 'dark',
  alwaysOnTop: true,
  orgId: null,
})

// ─── State ───────────────────────────────────────────────────────────────────
let mainWindow = null
let loginWindow = null
let pollTimer = null
let orgId = store.get('orgId')

const POLL_INTERVAL_MS = 60_000
const CLAUDE_BASE = 'https://claude.ai'

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function netRequest(url) {
  const res = await session.defaultSession.fetch(url, {
    headers: {
      'accept': 'application/json',
      'referer': `${CLAUDE_BASE}/`,
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
  })
  const body = await res.text()
  return { status: res.status, body }
}

async function hasClaudeSession() {
  const cookies = await session.defaultSession.cookies.get({ url: CLAUDE_BASE })
  return cookies.some(c =>
    c.name === '__ssid' ||
    c.name === 'sessionKey' ||
    c.name === 'activitySessionId'
  )
}

async function resolveOrgId() {
  if (orgId) return orgId

  // Try lastActiveOrg cookie first
  try {
    const cookies = await session.defaultSession.cookies.get({ url: CLAUDE_BASE })
    const lastActiveOrg = cookies.find(c => c.name === 'lastActiveOrg')
    if (lastActiveOrg?.value) {
      orgId = lastActiveOrg.value
      store.set('orgId', orgId)
      return orgId
    }
  } catch (_) {}

  // Try /api/account
  try {
    const { status, body } = await netRequest(`${CLAUDE_BASE}/api/account`)
    if (status === 200) {
      const data = JSON.parse(body)
      const candidate =
        data.id ??
        data.uuid ??
        data.memberships?.[0]?.organization?.uuid ??
        data.memberships?.[0]?.organization?.id
      if (candidate) {
        orgId = candidate
        store.set('orgId', orgId)
        return orgId
      }
    }
  } catch (_) {}

  // Try /api/bootstrap
  try {
    const { status, body } = await netRequest(`${CLAUDE_BASE}/api/bootstrap`)
    if (status === 200) {
      const data = JSON.parse(body)
      const candidate =
        data.account?.memberships?.[0]?.organization?.uuid ??
        data.account?.memberships?.[0]?.organization?.id ??
        data.organizations?.[0]?.uuid ??
        data.organizations?.[0]?.id
      if (candidate) {
        orgId = candidate
        store.set('orgId', orgId)
        return orgId
      }
    }
  } catch (_) {}

  throw new Error('Could not resolve org ID from claude.ai — please log in')
}

// ─── Usage Fetching ───────────────────────────────────────────────────────────
async function fetchUsage() {
  try {
    const id = await resolveOrgId()
    const { status, body } = await netRequest(
      `${CLAUDE_BASE}/api/organizations/${id}/usage`
    )

    if (status === 200) {
      const data = JSON.parse(body)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('usage-data', data)
      }
      return data
    }

    if (status === 401 || status === 403) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('auth-state', 'logged-out')
        mainWindow.webContents.send('usage-error', 'Session expired — click to log in again')
      }
      return null
    }

    throw new Error(`HTTP ${status}: ${body.slice(0, 120)}`)
  } catch (err) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('auth-state', 'logged-out')
      mainWindow.webContents.send('usage-error', err.message)
    }
    return null
  }
}

// ─── Poll Loop ────────────────────────────────────────────────────────────────
function startPolling() {
  if (pollTimer) clearInterval(pollTimer)
  fetchUsage()
  pollTimer = setInterval(fetchUsage, POLL_INTERVAL_MS)
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

// ─── Login Window ─────────────────────────────────────────────────────────────
function openLoginWindow() {
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.focus()
    return
  }

  loginWindow = new BrowserWindow({
    width: 900,
    height: 700,
    title: 'Log in to Claude — close when done',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      session: session.defaultSession,
    },
  })

  loginWindow.loadURL(`${CLAUDE_BASE}/login`)

  // Inject a "Done" button after each page load
  loginWindow.webContents.on('did-finish-load', () => {
    loginWindow.webContents.executeJavaScript(`
      (function() {
        const existing = document.getElementById('__widget_done_btn')
        if (existing) existing.remove()
        const btn = document.createElement('div')
        btn.id = '__widget_done_btn'
        btn.innerText = '✓ 已登入 Claude — 點此關閉'
        btn.style.cssText = [
          'position:fixed','bottom:24px','right:24px','z-index:2147483647',
          'background:#4A9EFF','color:#fff','padding:12px 22px',
          'border-radius:10px','cursor:pointer','font-family:system-ui',
          'font-size:14px','font-weight:700','letter-spacing:0.01em',
          'box-shadow:0 4px 16px rgba(0,0,0,0.35)',
          'transition:background 0.15s'
        ].join(';')
        btn.onmouseover = () => btn.style.background = '#2e85ff'
        btn.onmouseout  = () => btn.style.background = '#4A9EFF'
        btn.onclick = () => window.close()
        document.body.appendChild(btn)
      })()
    `).catch(() => {})
  })

  loginWindow.on('closed', async () => {
    loginWindow = null
    orgId = null
    store.delete('orgId')
    const data = await fetchUsage()
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (data) {
        mainWindow.webContents.send('auth-state', 'logged-in')
        startPolling()
      } else {
        mainWindow.webContents.send('auth-state', 'logged-out')
      }
    }
  })
}

// ─── Main Window ──────────────────────────────────────────────────────────────
function createMainWindow() {
  const savedX    = store.get('x')
  const savedY    = store.get('y')
  const layout    = store.get('layout')
  const alwaysOnTop = store.get('alwaysOnTop')
  const { w: winW, h: winH } = LAYOUTS[layout] ?? LAYOUTS.wide

  const { width: sw } =
    require('electron').screen.getPrimaryDisplay().workAreaSize
  const defaultX = sw - winW - 20
  const defaultY = 20

  mainWindow = new BrowserWindow({
    width: winW,
    height: winH,
    x: savedX ?? defaultX,
    y: savedY ?? defaultY,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: alwaysOnTop,
    skipTaskbar: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      session: session.defaultSession,
    },
  })

  mainWindow.loadFile(path.join(__dirname, 'index.html'))

  mainWindow.on('moved', () => {
    const [x, y] = mainWindow.getPosition()
    store.set('x', x)
    store.set('y', y)
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────
function registerIPC() {
  ipcMain.on('set-always-on-top', (_e, val) => {
    store.set('alwaysOnTop', val)
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setAlwaysOnTop(val)
  })

  ipcMain.on('set-theme', (_e, theme) => {
    store.set('theme', theme)
  })

  ipcMain.on('refresh', () => {
    fetchUsage()
  })

  ipcMain.handle('get-settings', () => ({
    theme: store.get('theme'),
    alwaysOnTop: store.get('alwaysOnTop'),
    layout: store.get('layout'),
  }))

  ipcMain.on('minimize-window', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize()
  })

  ipcMain.on('close-window', () => {
    app.quit()
  })

  ipcMain.on('open-login', () => {
    openLoginWindow()
  })

  ipcMain.on('set-layout', (_e, layout) => {
    const size = LAYOUTS[layout] ?? LAYOUTS.wide
    store.set('layout', layout)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setResizable(true)
      mainWindow.setSize(size.w, size.h, false)
      mainWindow.setResizable(false)
    }
  })
}

// ─── App Lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  registerIPC()
  createMainWindow()

  setTimeout(async () => {
    const loggedIn = await hasClaudeSession()
    if (loggedIn) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('auth-state', 'logged-in')
      }
      startPolling()
    } else {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('auth-state', 'logged-out')
        mainWindow.webContents.send('usage-error', 'Not logged in — click to open login window')
      }
    }
  }, 800)
})

app.on('window-all-closed', () => {
  stopPolling()
  app.quit()
})

app.on('activate', () => {
  if (!mainWindow) createMainWindow()
})
