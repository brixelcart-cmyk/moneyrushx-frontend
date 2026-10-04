const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL || ''

export const API_BASE_URL = configuredBaseUrl.replace(/\/+$/, '')

/** Initialize Telegram's Mini App bridge and return Telegram's untouched initData. */
export function getTelegramInitData() {
  const webApp = window.Telegram?.WebApp
  if (!webApp) return ''

  webApp.ready()
  webApp.expand()
  return typeof webApp.initData === 'string' ? webApp.initData : ''
}

/** Make an authenticated request using Telegram's raw initData as the auth header. */
export function authenticatedFetch(path, initData, options = {}) {
  const rawInitData = typeof initData === 'string' && initData.length
    ? initData
    : getTelegramInitData()
  if (!rawInitData) {
    throw new Error('Telegram authentication data is unavailable. Open the app from Telegram and retry.')
  }

  const headers = new Headers(options.headers || {})
  headers.set('X-Telegram-Init-Data', rawInitData)
  return fetch(`${API_BASE_URL}${path}`, { ...options, headers })
}
