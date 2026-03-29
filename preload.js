'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('widget', {
  // Receive usage data pushed from main process
  onData(cb) {
    ipcRenderer.on('usage-data', (_e, data) => cb(data))
  },
  // Receive error messages pushed from main process
  onError(cb) {
    ipcRenderer.on('usage-error', (_e, msg) => cb(msg))
  },
  // Receive auth state changes (logged-in / logged-out)
  onAuthState(cb) {
    ipcRenderer.on('auth-state', (_e, state) => cb(state))
  },
  // Toggle always-on-top
  setAlwaysOnTop(val) {
    ipcRenderer.send('set-always-on-top', val)
  },
  // Persist theme setting
  setTheme(theme) {
    ipcRenderer.send('set-theme', theme)
  },
  // Request immediate data refresh
  refresh() {
    ipcRenderer.send('refresh')
  },
  // Get persisted settings (returns Promise)
  getSettings() {
    return ipcRenderer.invoke('get-settings')
  },
  // Minimize the widget window
  minimizeWindow() {
    ipcRenderer.send('minimize-window')
  },
  // Close/hide the widget window
  closeWindow() {
    ipcRenderer.send('close-window')
  },
  // Open the Claude login window
  openLogin() {
    ipcRenderer.send('open-login')
  },
  // Switch between 'wide' and 'tall' layout presets
  setLayout(layout) {
    ipcRenderer.send('set-layout', layout)
  },
})
