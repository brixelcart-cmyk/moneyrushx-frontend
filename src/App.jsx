import { useCallback, useEffect, useState } from 'react'
import {
  ArrowUpRight,
  CircleDashed,
  CircleDollarSign,
  Gift,
  Gamepad2,
  House,
  ListChecks,
  UserRoundPlus,
  WalletCards,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import Wallet from './Wallet.jsx'
import Referral from './Referral.jsx'
import DailyBonus from './DailyBonus.jsx'
import CircleChallenge from './CircleChallenge.jsx'
import { authenticatedFetch, getTelegramInitData } from './api.js'
import './App.css'

function formatUsd(value) {
  const text = String(value ?? '')
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return '--'
  const [whole, fraction = ''] = text.split('.')
  return `$${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction.padEnd(2, '0')}`
}

function App() {
  const tg = window.Telegram?.WebApp
  const [initData, setInitData] = useState('')
  const [user, setUser] = useState(null)
  const [activeView, setActiveView] = useState('home')
  const [status, setStatus] = useState('loading')
  const updateBalance = useCallback((balance) => {
    setUser((current) => current ? { ...current, balance } : current)
  }, [])
  const [errorMessage, setErrorMessage] = useState(() => {
    if (!tg) return 'Open MoneyRushX from Telegram to load your account.'
    return ''
  })

  useEffect(() => {
    let active = true
    Promise.resolve().then(() => {
      if (!active) return
      const rawInitData = getTelegramInitData()
      setInitData(rawInitData)
      if (!rawInitData) {
        setErrorMessage('Telegram authentication data is unavailable. Reopen the app from Telegram.')
        setStatus('error')
        return
      }

      authenticatedFetch('/api/users', rawInitData, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_parameter: tg?.initDataUnsafe?.start_param || '' }),
      })
        .then(async (response) => {
          const data = await response.json()
          if (!response.ok) throw new Error(data.message || 'Could not load your account.')
          return data.user
        })
        .then((currentUser) => {
          if (active) {
            setUser(currentUser)
            setStatus('loaded')
          }
        })
        .catch((error) => {
          if (active) {
            setErrorMessage(error.message || 'Network error. Please try again.')
            setStatus('error')
          }
        })
    })

    return () => { active = false }
  }, [tg])

  const firstName = user?.first_name || 'there'
  const avatarLetter = user?.first_name?.[0] || 'M'

  return (
    <div className="app">
      <header className="header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true"><CircleDollarSign /></span>
          <div>
            <p className="welcome">WELCOME BACK</p>
            <h1>Hey, {firstName}</h1>
          </div>
        </div>
        <div className="avatar" aria-label={`${firstName}'s profile`}>{avatarLetter}</div>
      </header>

      {activeView === 'wallet' ? (
        <Wallet
          initData={initData}
          initialBalance={user?.balance}
          onBalanceUpdate={updateBalance}
        />
      ) : activeView === 'referrals' ? (
        <Referral initData={initData} />
      ) : activeView === 'daily-bonus' ? (
        <DailyBonus initData={initData} onBalanceUpdate={updateBalance} />
      ) : activeView === 'circle' ? (
        <CircleChallenge initData={initData} />
      ) : activeView === 'tasks' ? (
        <main className="tasks-view">
          <div className="screen-heading"><span className="screen-icon"><ListChecks aria-hidden="true" /></span><div><p className="section-kicker">YOUR NEXT STEP</p><h2>Tasks</h2></div></div>
          <div className="tasks-empty-art" aria-hidden="true"><Sparkles /><span /></div>
          <h3>More ways to earn are on the way</h3>
          <p>New tasks will be added soon. Check back here for fresh opportunities.</p>
        </main>
      ) : (
        <main className="home-view">
          <section className="balance-card" aria-live="polite">
            <div className="balance-card-top">
              <div>
                <p className="balance-eyebrow">YOUR WALLET</p>
                <p className="balance-label">Available balance <span>USD</span></p>
              </div>
              <span className="balance-shield" aria-label="Secure account"><ShieldCheck aria-hidden="true" /></span>
            </div>
            {status === 'loading' ? (
              <div className="balance-loading" role="status" aria-label="Loading balance"><span /><small>Loading balance…</small></div>
            ) : status === 'error' ? (
              <h2 className="account-error">Account unavailable</h2>
            ) : (
              <>
                <h2 className="balance-amount">{formatUsd(user?.balance)}</h2>
                <span className="balance-caption">Your current MoneyRushX balance</span>
              </>
            )}
            {status === 'error' && <p className="account-error-message">{errorMessage}</p>}
            <div className="balance-card-bottom">
              <span className="account-status"><i />{status === 'loaded' ? 'Account connected' : status === 'loading' ? 'Connecting securely' : 'Connection issue'}</span>
              <button className="balance-action" type="button" onClick={() => setActiveView('wallet')}>Open wallet <ArrowUpRight aria-hidden="true" /></button>
            </div>
          </section>

          <section className="today-section">
            <div className="home-section-title">
              <div><p className="section-kicker">TODAY’S OPPORTUNITY</p><h2>Keep your momentum</h2></div>
            </div>
            <button className="daily-home-link" type="button" onClick={() => setActiveView('daily-bonus')} aria-label="Open Daily Bonus">
              <span className="daily-home-link-icon"><Gift aria-hidden="true" /></span>
              <span className="daily-home-link-copy"><strong>Daily Bonus</strong><small>Visit today’s reward and keep your streak going</small></span>
              <span className="daily-home-link-arrow"><ArrowUpRight aria-hidden="true" /></span>
            </button>
          </section>

          <section className="earn-section">
            <div className="home-section-title">
              <div><p className="section-kicker">MAKE IT COUNT</p><h2>Earn more</h2></div>
              <span className="section-mark"><Sparkles aria-hidden="true" /></span>
            </div>
            <div className="quick-actions">
              <button className="action-card action-card-challenge" type="button" onClick={() => setActiveView('circle')}>
                <span className="action-icon"><CircleDashed aria-hidden="true" /></span><span className="action-arrow"><ArrowUpRight aria-hidden="true" /></span>
                <strong>Circle Challenge</strong><small>Put your precision to the test</small>
              </button>
              <button className="action-card action-card-referral" type="button" onClick={() => setActiveView('referrals')}>
                <span className="action-icon"><UserRoundPlus aria-hidden="true" /></span><span className="action-arrow"><ArrowUpRight aria-hidden="true" /></span>
                <strong>Refer &amp; Earn</strong><small>Invite friends and earn together</small>
              </button>
              <button className="action-card action-card-disabled" type="button" disabled>
                <span className="action-icon"><CircleDollarSign aria-hidden="true" /></span><span className="action-status">Coming soon</span>
                <strong>Watch &amp; Earn</strong><small>Rewarded ads aren’t available right now</small>
              </button>
            </div>
          </section>

          <section className="withdraw-card">
            <span className="withdraw-card-icon"><WalletCards aria-hidden="true" /></span>
            <div className="withdraw-card-copy"><p>READY WHEN YOU ARE</p><strong>Withdraw your earnings</strong><small>Minimum withdrawal $20.00</small></div>
            <button onClick={() => setActiveView('wallet')} aria-label="Open wallet to withdraw">Open <ArrowUpRight aria-hidden="true" /></button>
          </section>
        </main>
      )}

      <nav className="bottom-nav" aria-label="Main navigation">
        <button aria-current={activeView === 'home' ? 'page' : undefined} onClick={() => setActiveView('home')}>
          <House aria-hidden="true" /><span>Home</span>
        </button>
          <button aria-current={activeView === 'circle' ? 'page' : undefined} onClick={() => setActiveView('circle')}><Gamepad2 aria-hidden="true" /><span>Play</span></button>
        <button aria-current={activeView === 'tasks' ? 'page' : undefined} onClick={() => setActiveView('tasks')}><ListChecks aria-hidden="true" /><span>Tasks</span></button>
        <button aria-current={activeView === 'referrals' ? 'page' : undefined} onClick={() => setActiveView('referrals')}><UserRoundPlus aria-hidden="true" /><span>Refer</span></button>
        <button aria-current={activeView === 'wallet' ? 'page' : undefined} onClick={() => setActiveView('wallet')}>
          <WalletCards aria-hidden="true" /><span>Wallet</span>
        </button>
      </nav>
    </div>
  )
}

export default App
