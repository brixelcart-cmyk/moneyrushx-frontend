import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Copy, Gift, Send, Users, UserRoundPlus } from 'lucide-react'
import { authenticatedFetch } from './api.js'
import './Referral.css'


function formatUsd(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? `$${amount.toFixed(2)}` : '$0.00'
}

export default function Referral({ initData }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const requestRef = useRef(null)

  const loadReferrals = useCallback(async () => {
    requestRef.current?.abort()
    setLoading(true)
    setError('')
    if (!initData) {
      setError('Telegram authentication data is unavailable. Reopen Referrals from Telegram.')
      setLoading(false)
      return
    }
    const controller = new AbortController()
    requestRef.current = controller
    try {
      const response = await authenticatedFetch('/api/referrals', initData, { signal: controller.signal })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Could not load referrals.')
      setData(result)
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause.message || 'Could not load referrals.')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [initData])

  useEffect(() => {
    const timer = window.setTimeout(() => { loadReferrals() }, 0)
    return () => {
      window.clearTimeout(timer)
      requestRef.current?.abort()
    }
  }, [loadReferrals])

  async function copyLink() {
    if (!data?.referral_link) return
    try {
      await navigator.clipboard.writeText(data.referral_link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('Could not copy the link. Please select and copy it.')
    }
  }

  const shareUrl = data?.referral_link
    ? `https://t.me/share/url?url=${encodeURIComponent(data.referral_link)}&text=${encodeURIComponent('Join me on MoneyRushX!')}`
    : '#'

  return (
    <main className="referral-page">
      <header className="referral-heading">
        <span className="referral-heading-icon"><UserRoundPlus aria-hidden="true" /></span>
        <div><p>GROW YOUR CREW</p><h2>Refer &amp; Earn</h2></div>
      </header>
      <section className="referral-hero">
        <div className="referral-gift"><Gift aria-hidden="true" /></div>
        <h3>Earn together</h3>
        <p>Earn $0.25 when your friend joins and another $0.25 when they complete 10 ads.</p>
      </section>
      {error && <p className="referral-error" role="alert">{error}</p>}
      {error && !loading && <button className="referral-copy" type="button" onClick={loadReferrals}>Retry loading referrals</button>}
      <section className="referral-stats" aria-label="Referral statistics">
        <article className="referral-stat referral-stat-total"><span>Total earnings</span><strong>{data ? formatUsd(data.total_earnings_usd) : '—'}</strong></article>
        <article className="referral-stat"><span>Successful referrals</span><strong>{data ? `${data.total_successful_referrals} / 10` : '—'}</strong></article>
        <article className="referral-stat"><span>Slots remaining</span><strong>{data?.remaining_slots ?? '—'}</strong></article>
      </section>
      <section className="referral-link-card">
        <div className="referral-section-title"><Users aria-hidden="true" /><h3>Your invite link</h3></div>
        <p>Share your personal link with friends.</p>
        <div className="referral-link-field">{data?.referral_link || (loading ? 'Loading your link…' : 'Referral link unavailable')}</div>
        <div className="referral-link-actions">
          <button className="referral-copy" onClick={copyLink} disabled={!data?.referral_link}>
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{copied ? 'Copied' : 'Copy link'}
          </button>
          <a className="referral-share" href={shareUrl} target="_blank" rel="noreferrer" aria-disabled={!data?.referral_link}>
            <Send aria-hidden="true" />Share on Telegram
          </a>
        </div>
      </section>
      <section className="referral-list-section">
        <div className="referral-section-title"><Users aria-hidden="true" /><h3>Your referrals</h3></div>
        {!data ? <p className="referral-empty">{loading ? 'Loading referrals…' : 'Referral details are unavailable.'}</p> : data.referrals.length === 0 ? (
          <p className="referral-empty">Your invited friends will appear here.</p>
        ) : (
          <ul className="referral-list">
            {data.referrals.map((referral, index) => (
              <li className="referral-person" key={`${referral.display_name}-${index}`}>
                <div className="referral-person-avatar">{referral.display_name.replace('@', '').charAt(0).toUpperCase()}</div>
                <div className="referral-person-main"><strong>{referral.display_name}</strong>
                  <span>{referral.joined_rewarded ? 'Joined · $0.25 earned' : 'Joined'}</span>
                  <span>{referral.milestone_rewarded ? '10 ads completed · additional $0.25 earned' : `${referral.verified_ads}/10 verified ads`}</span>
                </div>
                <span className="referral-status-icon" aria-label={referral.milestone_rewarded ? 'Completed' : 'In progress'}>{referral.milestone_rewarded ? <Check aria-hidden="true" /> : <Gift aria-hidden="true" />}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
