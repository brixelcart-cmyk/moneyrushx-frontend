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
  const requestUrl = `${API_BASE_URL}${path}`
  const requestInfo = {
    apiBaseUrl: API_BASE_URL,
    path,
    requestUrl,
    initDataPresent: Boolean(rawInitData),
    initDataLength: rawInitData.length,
  }

  if (!rawInitData) {
    console.warn('API request not sent: Telegram initData unavailable', requestInfo)
    throw new Error('Telegram authentication data is unavailable. Open the app from Telegram and retry.')
  }

  console.info('API request starting', requestInfo)
  try {
    const headers = new Headers(options.headers || {})
    headers.set('X-Telegram-Init-Data', rawInitData)
    return fetch(requestUrl, { ...options, headers }).then((response) => {
      console.info('API response received', {
        path,
        requestUrl,
        status: response.status,
        ok: response.ok,
      })
      return response
    }, () => {
      console.warn('API request failed before receiving a response', {
        path,
        requestUrl,
      })
      throw new Error('Network error. Please retry.')
    })
  } catch {
    console.warn('API request failed before dispatch', {
      path,
      requestUrl,
    })
    throw new Error('Network error. Please retry.')
  }
}
