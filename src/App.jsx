import { useCallback, useEffect, useState } from 'react'
import {
  CircleDashed,
  CircleDollarSign,
  Gift,
  Gamepad2,
  House,
  ListChecks,
  UserRoundPlus,
  WalletCards,
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
        <div>
          <p className="welcome">Welcome {firstName}</p>
          <h1>MoneyRushX</h1>
        </div>
        <div className="avatar">{avatarLetter}</div>
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
        <main className="tasks-view"><h2>Tasks</h2><p>New tasks will be added soon.</p></main>
      ) : (
        <>
          <section className="balance-card" aria-live="polite">
            <p>Available Balance</p>
            {status === 'loading' ? (
              <h2>Loading...</h2>
            ) : status === 'error' ? (
              <h2 className="account-error">Account unavailable</h2>
            ) : (
              <>
                <h2>{formatUsd(user?.balance)}</h2>
                <span>Withdrawable USD balance</span>
              </>
            )}
            {status === 'error' && <p className="account-error-message">{errorMessage}</p>}
          </section>

          <button
            className="daily-home-link"
            type="button"
            onClick={() => setActiveView('daily-bonus')}
            aria-label="Open Daily Bonus and claim today's reward"
          >
            <span className="daily-home-link-icon"><Gift aria-hidden="true" /></span>
            <span className="daily-home-link-copy">
              <strong>Daily Bonus</strong>
              <small>Claim today’s login reward and keep your streak</small>
            </span>
            <span className="daily-home-link-arrow" aria-hidden="true">›</span>
          </button>

          <section className="quick-actions">
            <button className="action-card action-card-primary" type="button" disabled>
              <span className="action-icon"><CircleDollarSign aria-hidden="true" /></span>
              <strong>Watch &amp; Earn</strong>
              <small>Rewarded ads are not available right now.</small>
            </button>
            <button className="action-card" type="button" onClick={() => setActiveView('circle')}>
              <span className="action-icon"><CircleDashed aria-hidden="true" /></span>
              <strong>Circle Challenge</strong>
              <small>Win up to $10 daily</small>
            </button>
            <button className="action-card" type="button" onClick={() => setActiveView('referrals')}>
              <span className="action-icon"><UserRoundPlus aria-hidden="true" /></span>
              <strong>Refer &amp; Earn</strong>
              <small>Invite friends</small>
            </button>
          </section>

          <section className="withdraw-card">
            <div>
              <p>Withdrawal</p>
              <strong>$20.00 minimum</strong>
            </div>
            <button onClick={() => setActiveView('wallet')}>Withdraw</button>
          </section>
        </>
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
