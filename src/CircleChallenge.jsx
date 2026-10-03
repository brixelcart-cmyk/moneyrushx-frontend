import { useCallback, useEffect, useRef, useState } from 'react'
import { Award, CircleDashed, LockKeyhole, Medal, RotateCcw, Sparkles, Target, Trophy, Users, X } from 'lucide-react'
import { API_BASE_URL } from './api.js'
import './CircleChallenge.css'

const CANVAS_SIZE = 1000

function money(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? `$${parsed.toFixed(2)}` : '$0.00'
}

function estimateAccuracy(points, target) {
  if (points.length < 3 || !target) return 0
  const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length
  const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length
  const radii = points.map((p) => Math.hypot(p.x - cx, p.y - cy))
  const radius = radii.reduce((sum, value) => sum + value, 0) / radii.length
  const deviation = Math.sqrt(radii.reduce((sum, value) => sum + (value - radius) ** 2, 0) / radii.length)
  const centerError = Math.hypot(cx - target.x, cy - target.y)
  const closureError = Math.hypot(points[0].x - points.at(-1).x, points[0].y - points.at(-1).y)
  const shape = Math.max(0, 1 - deviation / Math.max(radius * 0.32, 1))
  const center = Math.max(0, 1 - centerError / (target.radius * 0.55))
  const size = Math.max(0, 1 - Math.abs(radius - target.radius) / (target.radius * 0.45))
  const closure = Math.max(0, 1 - closureError / (target.radius * 0.55))
  return Math.max(0, Math.min(100, shape * 30 + center * 25 + size * 25 + closure * 10 + 10))
}

export default function CircleChallenge({ initData }) {
  const canvasRef = useRef(null)
  const pointsRef = useRef([])
  const drawingRef = useRef(false)
  const frameRef = useRef(0)
  const renderedCountRef = useRef(0)
  const requestRef = useRef({ id: 0, controller: null })
  const [challenge, setChallenge] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [liveEstimate, setLiveEstimate] = useState(0)
  const [result, setResult] = useState(null)
  const [adMessage, setAdMessage] = useState('')
  const canDraw = Boolean(challenge?.challenge?.target) && !busy

  const loadChallenge = useCallback(async () => {
    const requestId = requestRef.current.id + 1
    requestRef.current.controller?.abort()
    if (!initData) {
      requestRef.current = { id: requestId, controller: null }
      setChallenge(null)
      setError('Telegram authentication data is unavailable. Reopen Circle Challenge from Telegram, then retry.')
      setLoading(false)
      return
    }
    const controller = new AbortController()
    requestRef.current = { id: requestId, controller }
    const timeoutId = window.setTimeout(() => controller.abort(), 15000)
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/circle-challenge/today`, {
        headers: { 'X-Telegram-Init-Data': initData },
        signal: controller.signal,
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.message || 'Could not load Circle Challenge.')
      const target = payload?.challenge?.target
      if (!payload?.challenge_date_utc || ![target?.x, target?.y, target?.radius].every((value) => Number.isFinite(Number(value))) || Number(target.radius) <= 0) {
        throw new Error('The Circle Challenge response did not include a valid target. Please retry.')
      }
      if (requestRef.current.id !== requestId) return
      setChallenge(payload)
      setError('')
    } catch (cause) {
      if (requestRef.current.id === requestId) {
        setError(controller.signal.aborted
          ? 'Loading Circle Challenge timed out. Check your connection and retry.'
          : cause.message || 'Could not load Circle Challenge.')
      }
    } finally {
      window.clearTimeout(timeoutId)
      if (requestRef.current.id === requestId) setLoading(false)
    }
  }, [initData])

  useEffect(() => {
    const timer = window.setTimeout(() => { loadChallenge() }, 0)
    return () => {
      window.clearTimeout(timer)
      const { id, controller } = requestRef.current
      requestRef.current = { id: id + 1, controller: null }
      controller?.abort()
    }
  }, [loadChallenge])

  const drawGuide = useCallback(() => {
    const canvas = canvasRef.current
    const target = challenge?.challenge?.target
    if (!canvas || !target) return
    const context = canvas.getContext('2d')
    context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

    const corners = [
      { x: 1, y: 1, angle: -Math.PI * 0.75 },
      { x: CANVAS_SIZE - 1, y: 1, angle: -Math.PI * 0.25 },
      { x: CANVAS_SIZE - 1, y: CANVAS_SIZE - 1, angle: Math.PI * 0.25 },
      { x: 1, y: CANVAS_SIZE - 1, angle: Math.PI * 0.75 },
    ]
    const corner = corners[Math.floor(Math.random() * corners.length)]
    const centerX = corner.x === 1 ? target.radius * 1.08 : CANVAS_SIZE - target.radius * 1.08
    const centerY = corner.y === 1 ? target.radius * 1.08 : CANVAS_SIZE - target.radius * 1.08
    const guideArc = Math.PI * 70 / 180

    context.save()
    context.beginPath()
    context.arc(centerX, centerY, target.radius, corner.angle - guideArc / 2, corner.angle + guideArc / 2)
    context.setLineDash([6, 9])
    context.lineWidth = 4
    context.strokeStyle = 'rgba(177, 190, 178, .46)'
    context.stroke()
    context.restore()
  }, [challenge])

  useEffect(() => { drawGuide() }, [drawGuide])

  const renderStroke = useCallback(() => {
    const canvas = canvasRef.current
    const points = pointsRef.current
    if (!canvas || points.length < 2) return
    const context = canvas.getContext('2d')
    context.save()
    context.lineCap = 'round'
    context.lineJoin = 'round'
    for (let i = renderedCountRef.current; i < points.length - 1; i += 1) {
      const a = points[i]
      const b = points[i + 1]
      context.beginPath()
      context.moveTo(a.x, a.y)
      context.lineTo(b.x, b.y)
      context.strokeStyle = '#a5ffd0'
      context.lineWidth = 12
      context.shadowColor = '#22ef91'
      context.shadowBlur = 22
      context.stroke()
      context.strokeStyle = '#eafff3'
      context.lineWidth = 5
      context.shadowColor = '#baffd5'
      context.shadowBlur = 7
      context.stroke()
    }
    renderedCountRef.current = Math.max(0, points.length - 1)
    context.restore()
  }, [])

  function canvasPoint(event) {
    const rect = canvasRef.current.getBoundingClientRect()
    return { x: Math.max(0, Math.min(CANVAS_SIZE, (event.clientX - rect.left) * CANVAS_SIZE / rect.width)), y: Math.max(0, Math.min(CANVAS_SIZE, (event.clientY - rect.top) * CANVAS_SIZE / rect.height)) }
  }

  function startDrawing(event) {
    if (!canDraw) return
    event.preventDefault()
    drawingRef.current = true
    setIsDrawing(true)
    pointsRef.current = [canvasPoint(event)]
    renderedCountRef.current = 0
    setLiveEstimate(0)
    canvasRef.current.setPointerCapture(event.pointerId)
  }

  function continueDrawing(event) {
    if (!drawingRef.current || pointsRef.current.length >= 420) return
    event.preventDefault()
    const next = canvasPoint(event)
    const points = pointsRef.current
    const last = points[points.length - 1]
    if (Math.hypot(next.x - last.x, next.y - last.y) < 1.2) return
    points.push(next)
    setLiveEstimate((current) => current + (estimateAccuracy(points, challenge?.challenge?.target) - current) * 0.22)
    if (!frameRef.current) frameRef.current = requestAnimationFrame(() => { frameRef.current = 0; renderStroke() })
  }

  function stopDrawing() { drawingRef.current = false; setIsDrawing(false) }

  async function verifyUnlock() {
    if (!initData || !challenge?.challenge_date_utc || busy) return
    setBusy(true); setError(''); setMessage(''); setAdMessage('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/circle-challenge/unlock`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': initData }, body: JSON.stringify({ challenge_date: challenge.challenge_date_utc }) })
      const payload = await response.json()
      if (!response.ok) {
        const message = response.status === 403
          ? 'Ad provider not connected yet. No verified rewarded ad record was found, so another attempt was not granted.'
          : payload.message || 'Could not verify the ad unlock. No additional attempt was granted.'
        throw new Error(message)
      }
      setAdMessage('A verified ad unlock is already recorded. Another attempt is not available today.')
      await loadChallenge()
    } catch (cause) { setAdMessage(cause.message || 'Ad provider not connected yet. No verified ad was found.') } finally { setBusy(false) }
  }

  async function submit(practice) {
    if (!initData || !challenge?.challenge_date_utc || busy) return
    const points = pointsRef.current
    if (points.length < 18) { setError('Draw a complete circle with one continuous stroke first.'); return }
    setBusy(true); setError(''); setMessage('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/circle-challenge/${practice ? 'practice' : 'submit'}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': initData }, body: JSON.stringify({ challenge_date: challenge.challenge_date_utc, points }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.message || 'Could not calculate your score.')
      if (!Number.isFinite(Number(payload.score))) throw new Error('The server response did not include a valid score.')
      setResult({ practice, score: Number(payload.score), position: payload.position ?? null })
      if (practice) setMessage('Practice score calculated. It does not affect the leaderboard or prizes.')
      else await loadChallenge()
      pointsRef.current = []
      setLiveEstimate(0)
      drawGuide()
    } catch (cause) { setError(cause.message || 'Could not calculate your score.') } finally { setBusy(false) }
  }

  async function confirmOfficialScore() {
    if (!initData || !challenge?.challenge_date_utc || busy) return
    setBusy(true); setError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/circle-challenge/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': initData }, body: JSON.stringify({ challenge_date: challenge.challenge_date_utc }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.message || 'Could not submit your official score.')
      setResult(null)
      setMessage(`Official score submitted${payload.position ? ` · leaderboard position #${payload.position}` : ''}.`)
      await loadChallenge()
    } catch (cause) { setError(cause.message || 'Could not submit your official score.') } finally { setBusy(false) }
  }

  const pool = challenge?.prize_pool
  const activeCount = Number(pool?.active_user_count || 0)
  const activeProgress = Math.min(100, activeCount / 1000 * 100)
  const prizes = pool?.prizes_usd || ['10.00', '5.00', '3.00']
  const own = challenge?.own_result
  const adUnlockRequired = challenge?.official_unlock_required !== false

  return (
    <main className="circle-page">
      <header className="circle-heading"><span className="circle-heading-icon"><CircleDashed aria-hidden="true" /></span><div><p>DAILY SKILL CHALLENGE</p><h2>Circle Challenge</h2></div></header>
      <section className="circle-pool-card">
        <div className="circle-pool-top"><span>DAILY PRIZE POOL</span><span className="circle-live"><i /> {activeCount.toLocaleString()} active</span></div>
        <strong className="circle-pool-total">{money(pool?.pool_usd)}</strong>
        <div className="circle-prize-places">{['1st', '2nd', '3rd'].map((place, index) => <div key={place}><span>{place}</span><strong>{money(prizes[index])}</strong></div>)}</div>
        <div className="circle-active-progress"><div><span>Active players</span><strong>{activeCount.toLocaleString()} / 1,000</strong></div><span className="circle-progress-track"><i style={{ width: `${activeProgress}%` }} /></span></div>
        <aside className="circle-promo"><Sparkles aria-hidden="true" /><p><strong>Invite more friends!</strong><br />The more active players we have, the bigger the daily prize pool becomes. 🚀<br /><b>1,000 active players = 2× the base prize pool!</b></p></aside>
        <small className="circle-pool-range">The pool ranges from $18/day to up to $36/day.</small>
      </section>
      <section className="circle-play-card">
        <div className="circle-section-heading"><div><h3>Today’s challenge</h3><p>{challenge?.challenge_date_utc || 'Loading UTC date…'}</p></div><span className="circle-difficulty">HARD</span></div>
        <p className="circle-instructions">Trace the dashed circle in one smooth, continuous stroke. Your official score is calculated by the server.</p>
        <div className="circle-canvas-wrap">
          <div className={`circle-live-score ${isDrawing ? 'is-drawing' : ''}`} aria-live="off"><strong>{liveEstimate.toFixed(1)}<small>%</small></strong><span>LIVE ESTIMATE</span></div>
          <canvas ref={canvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE} aria-label="Draw over the guide circle" onPointerDown={startDrawing} onPointerMove={continueDrawing} onPointerUp={stopDrawing} onPointerCancel={stopDrawing} onLostPointerCapture={stopDrawing} />
          {!challenge && <span className="circle-canvas-loading">{loading ? 'Loading today’s target…' : error || 'Today’s challenge is unavailable.'}</span>}
          {challenge?.own_result && <span className="circle-canvas-done">Official score submitted</span>}
        </div>
        <div className="circle-submit-actions">
          <button className="circle-practice-button" type="button" disabled={busy || loading || !challenge} onClick={() => submit(true)}><RotateCcw aria-hidden="true" />Practice</button>
          <button className="circle-submit-button" type="button" disabled={busy || loading || !challenge?.official_unlocked || challenge?.official_attempt_used || Boolean(challenge?.pending_result)} onClick={() => submit(false)}>{challenge?.official_attempt_used ? 'Attempt submitted' : challenge?.pending_result ? 'Score pending confirmation' : busy ? 'Scoring…' : 'Score official attempt'}</button>
        </div>
        {adUnlockRequired ? <div className="circle-unlock-note"><LockKeyhole aria-hidden="true" /><p>{challenge?.official_unlocked ? 'Official attempt unlocked. Your score is added only when you choose Submit Score.' : 'Official entry requires one verified rewarded ad. Verify after a qualifying rewarded ad is recorded.'}</p></div> : <div className="circle-unlock-note"><p>Testing mode: official attempts are available without an ad. Scores are still calculated by the server.</p></div>}
        {adUnlockRequired && challenge && !challenge.official_unlocked && !challenge.official_attempt_used && <button className="circle-unlock-button" type="button" disabled={busy || loading} onClick={verifyUnlock}>Verify ad unlock</button>}
        {adMessage && <p className="circle-message circle-error" role="status">{adMessage}</p>}
        {message && <p className="circle-message circle-success" role="status">{message}</p>}
        {error && <p className="circle-message circle-error" role="alert">{error}</p>}
        {error && !loading && <button className="circle-unlock-button" type="button" onClick={loadChallenge}>Retry challenge</button>}
        {challenge?.pending_result && !result && <button className="circle-unlock-button" type="button" onClick={() => setResult({ practice: false, score: Number(challenge.pending_result.score), position: null })}>Review pending score · {Number(challenge.pending_result.score).toFixed(2)}%</button>}
        <p className="circle-your-score"><Target aria-hidden="true" />{own ? <>{own.status === 'disqualified' ? 'Your entry was disqualified' : <>Your score: <strong>{Number(own.score).toFixed(2)}%</strong>{own.position ? ` · #${own.position}` : ''}</>}</> : 'You have not submitted an official score today.'}</p>
      </section>
      <section className="circle-board-card">
        <div className="circle-section-heading"><div><h3><Trophy aria-hidden="true" /> Today’s leaderboard</h3><p>Highest score wins · ties go to the earlier submission</p></div><Users aria-hidden="true" /></div>
        {challenge?.leaderboard?.length ? <ol className="circle-board-list">{challenge.leaderboard.map((entry) => <li key={`${entry.position}-${entry.display_name}`} className={own && Number(own.position) === entry.position ? 'circle-board-self' : ''}><span className={`circle-rank rank-${entry.position}`}>{entry.position <= 3 ? <Medal aria-hidden="true" /> : entry.position}</span><span className="circle-player-name">{entry.display_name}</span><strong>{Number(entry.score).toFixed(2)}%</strong></li>)}</ol> : <p className="circle-board-empty">No official scores yet. Be the first to take today’s challenge.</p>}
      </section>
      <p className="circle-prize-footnote"><Award aria-hidden="true" /> Prizes are calculated by the server and reviewed after the daily leaderboard is finalized. They are not paid automatically.</p>
      {result && <div className="circle-modal-backdrop" role="presentation"><section className="circle-result-modal" role="dialog" aria-modal="true" aria-labelledby="circle-result-title"><button className="circle-modal-close" type="button" aria-label="Close result" onClick={() => setResult(null)}><X /></button><div className="circle-result-orbit"><CircleDashed aria-hidden="true" /></div><p className="circle-result-eyebrow">{result.practice ? 'PRACTICE COMPLETE' : 'CHALLENGE COMPLETE'}</p><h2 id="circle-result-title">{result.practice ? 'Practice Score' : 'Your Score'}</h2><strong className="circle-result-score">{result.score.toFixed(2)}<small>%</small></strong><p className="circle-result-copy">{result.practice ? 'Practice only · no leaderboard entry or prizes' : 'Server-calculated accuracy. Your result is ready.'}</p>
        {result.practice ? <button className="circle-modal-primary" type="button" onClick={() => { setResult(null); pointsRef.current = []; drawGuide() }}>Try Again</button> : <><button className="circle-modal-primary" type="button" disabled={busy} onClick={confirmOfficialScore}>{busy ? 'Submitting…' : 'Submit Score'}</button>{adUnlockRequired && <button className="circle-modal-secondary" type="button" disabled={busy} onClick={verifyUnlock}>Watch Ad &amp; Try Again</button>}{error && <p className="circle-modal-ad-message" role="alert">{error}</p>}{adMessage && <p className="circle-modal-ad-message" role="status">{adMessage}</p>}<p className="circle-modal-footnote">Your score joins today’s leaderboard only after you submit it.</p></>}
      </section></div>}
    </main>
  )
}
