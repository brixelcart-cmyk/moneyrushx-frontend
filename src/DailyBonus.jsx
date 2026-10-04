import { useCallback, useEffect, useState } from 'react'
import { Check, ChevronRight, Circle, Gift, RotateCcw } from 'lucide-react'
import { authenticatedFetch } from './api.js'
import './DailyBonus.css'

const REWARDS = ['0.10', '0.15', '0.20', '0.25', '0.30', '0.40', '0.60']

function money(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? `$${amount.toFixed(2)}` : '$0.00'
}

export default function DailyBonus({ initData, onBalanceUpdate }) {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadStatus = useCallback(async () => {
    if (!initData) {
      setError('Telegram authentication data is unavailable. Reopen Daily Bonus from Telegram.')
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const response = await authenticatedFetch('/api/daily-bonus/status', initData)
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Could not load daily bonus.')
      setStatus(result)
      setError('')
    } catch (cause) {
      setError(cause.message || 'Could not load daily bonus.')
    } finally {
      setLoading(false)
    }
  }, [initData])

  useEffect(() => {
    const timer = window.setTimeout(() => { loadStatus() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadStatus])

  async function claimReward() {
    if (!initData || claiming || !status?.eligible_to_claim) return
    setClaiming(true)
    setError('')
    setNotice('')
    try {
      const response = await authenticatedFetch('/api/daily-bonus/claim', initData, {
        method: 'POST',
      })
      const result = await response.json()
      if (result.success && result.claimed_reward_usd) {
        onBalanceUpdate?.(result.balance_usd)
        setNotice(`You received ${money(result.claimed_reward_usd)}.`)
      } else if (!response.ok) {
        throw new Error(result.message || 'Could not claim your reward.')
      }
      if (result.success) setStatus(result)
    } catch (cause) {
      setError(cause.message || 'Could not claim your reward.')
      await loadStatus()
    } finally {
      setClaiming(false)
    }
  }

  const currentDay = status?.current_streak_day ?? 1
  const claimedToday = Boolean(status?.claimed_today)
  const earned = Number(status?.current_cycle_earned_usd || 0)
  const progress = Math.max(0, Math.min(100, earned / 2 * 100))

  return (
    <main className="daily-page">
      <header className="daily-heading">
        <span className="daily-heading-icon"><Gift aria-hidden="true" /></span>
        <div><p>KEEP YOUR MOMENTUM</p><h2>Daily Bonus</h2></div>
      </header>

      <section className="daily-today-card">
        <div className="daily-today-top"><span>DAY {currentDay} OF 7</span><span className="daily-streak-pill"><span aria-hidden="true">✦</span> {status?.current_streak ?? '—'} day streak</span></div>
        <p className="daily-today-label">Today's reward</p>
        <strong className="daily-today-amount">{status ? money(status.today_reward_usd) : '—'}</strong>
        <button className="daily-claim-button" disabled={loading || claiming || !status?.eligible_to_claim} onClick={claimReward}>
          {claiming ? 'Claiming…' : claimedToday ? <><Check aria-hidden="true" /> Claimed today</> : 'Claim today’s reward'}
        </button>
        {!claimedToday && <p className="daily-next-reward">Next reward: {status ? money(status.next_reward_usd) : '—'}</p>}
      </section>

      {error && <p className="daily-message daily-error" role="alert">{error}</p>}
      {error && !loading && <button className="daily-claim-button" type="button" onClick={loadStatus}>Retry loading bonus</button>}
      {notice && <p className="daily-message daily-success" role="status">{notice}</p>}

      <section className="daily-progress-card">
        <div className="daily-progress-heading"><div><span>THIS 7-DAY CYCLE</span><h3>{money(status?.current_cycle_earned_usd)} <small>of $2.00</small></h3></div><strong>{Math.round(progress)}%</strong></div>
        <div className="daily-progress-track" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${progress}%` }} /></div>
        <p>Complete all 7 days to earn $2.00 in this streak.</p>
      </section>

      <section className="daily-days-card">
        <div className="daily-days-title"><div><h3>7-day progression</h3><p>Claim once each day to keep your streak going.</p></div><ChevronRight aria-hidden="true" /></div>
        <ol className="daily-days-list">
          {REWARDS.map((reward, index) => {
            const day = index + 1
            const isCurrent = day === currentDay && !claimedToday
            const isClaimed = day < currentDay || (day === currentDay && claimedToday)
            return (
              <li className={`daily-day ${isClaimed ? 'is-claimed' : ''} ${isCurrent ? 'is-current' : ''}`} key={day}>
                <span className="daily-day-icon">{isClaimed ? <Check aria-label="Claimed" /> : isCurrent ? <Gift aria-label="Current day" /> : <Circle aria-label="Locked" />}</span>
                <span className="daily-day-label"><strong>Day {day}</strong><small>{isClaimed ? 'Claimed' : isCurrent ? 'Today · ready to claim' : 'Locked'}</small></span>
                <strong className="daily-day-reward">{money(reward)}</strong>
              </li>
            )
          })}
        </ol>
      </section>

      <aside className="daily-reset-note"><RotateCcw aria-hidden="true" /><p><strong>Don’t miss a day.</strong> Missing a calendar day resets your streak to Day 1. All days are based on UTC.</p></aside>
    </main>
  )
}
