import { useCallback, useEffect, useState } from 'react'
import { authenticatedFetch } from './api.js'
import './Wallet.css'

const NETWORKS = ['TRC20', 'ERC20', 'BEP20']

function formatUsd(value) {
  const text = String(value ?? '')
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return '--'
  const [whole, fraction = ''] = text.split('.')
  return `$${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction.padEnd(2, '0')}`
}

function Wallet({ initData, initialBalance, onBalanceUpdate }) {
  const [balance, setBalance] = useState(initialBalance ?? '0.00')
  const [withdrawals, setWithdrawals] = useState([])
  const [walletAddress, setWalletAddress] = useState('')
  const [network, setNetwork] = useState(NETWORKS[0])
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadWallet = useCallback(async () => {
    if (!initData) {
      setError('Telegram authentication data is unavailable. Reopen the wallet from Telegram.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const [walletResponse, historyResponse] = await Promise.all([
        authenticatedFetch('/api/wallet', initData),
        authenticatedFetch('/api/withdrawals', initData),
      ])
      const [walletData, historyData] = await Promise.all([walletResponse.json(), historyResponse.json()])
      if (!walletResponse.ok) throw new Error(walletData.message || 'Could not load your wallet.')
      if (!historyResponse.ok) throw new Error(historyData.message || 'Could not load withdrawal history.')
      setBalance(walletData.available_balance_usd)
      onBalanceUpdate?.(walletData.available_balance_usd)
      setWithdrawals(historyData.withdrawals || [])
    } catch (loadError) {
      setError(loadError.message || 'Could not load your wallet.')
    } finally {
      setLoading(false)
    }
  }, [initData, onBalanceUpdate])

  useEffect(() => {
    const timer = window.setTimeout(() => { loadWallet() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadWallet])

  async function submitWithdrawal(event) {
    event.preventDefault()
    setMessage('')
    setError('')
    if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(amount)) {
      setError('Enter a valid USD amount with up to two decimal places.')
      return
    }
    const [whole, fraction = ''] = amount.split('.')
    const amountCents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
    if (amountCents < 2000n) {
      setError('The minimum withdrawal is $20.00.')
      return
    }
    setSubmitting(true)
    try {
      const response = await authenticatedFetch('/api/withdrawals', initData, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_usd: amount, wallet_address: walletAddress, network }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Could not submit withdrawal.')
      setBalance(data.available_balance_usd)
      onBalanceUpdate?.(data.available_balance_usd)
      setWithdrawals((current) => [data.withdrawal, ...current])
      setWalletAddress('')
      setAmount('')
      setMessage('Withdrawal submitted for manual review.')
    } catch (submitError) {
      setError(submitError.message || 'Could not submit withdrawal.')
    } finally {
      setSubmitting(false)
    }
  }

  async function cancelWithdrawal(id) {
    setError('')
    setMessage('')
    try {
      const response = await authenticatedFetch(`/api/withdrawals/${encodeURIComponent(id)}/cancel`, initData, {
        method: 'POST',
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Could not cancel withdrawal.')
      setMessage('Withdrawal cancelled and the amount returned to your available balance.')
      await loadWallet()
    } catch (cancelError) {
      setError(cancelError.message || 'Could not cancel withdrawal.')
    }
  }

  return (
    <main className="wallet-view">
      <div className="wallet-heading">
        <h2>Wallet</h2>
        <p>Withdrawals are reviewed and paid manually.</p>
      </div>

      <section className="wallet-balance-card" aria-live="polite">
        <p>Available balance</p>
        <strong>{loading ? 'Loading…' : formatUsd(balance)}</strong>
      </section>

      <form className="wallet-form" onSubmit={submitWithdrawal}>
        <h3>Request a withdrawal</h3>
        <p className="wallet-minimum">Minimum withdrawal: $20.00. Paid manually after review in USDT on TRC20, ERC20, or BEP20.</p>

        <label htmlFor="wallet-address">USDT wallet address</label>
        <input
          id="wallet-address"
          autoComplete="off"
          value={walletAddress}
          onChange={(event) => setWalletAddress(event.target.value)}
          placeholder="Enter your USDT address"
          maxLength={200}
          required
        />

        <label htmlFor="wallet-network">Network</label>
        <select id="wallet-network" value={network} onChange={(event) => setNetwork(event.target.value)}>
          {NETWORKS.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>

        <label htmlFor="withdrawal-amount">Amount (USD)</label>
        <input
          id="withdrawal-amount"
          inputMode="decimal"
          autoComplete="off"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="20.00"
          required
        />

      {error && <p className="wallet-message wallet-error" role="alert">{error}</p>}
      {error && !loading && <button className="wallet-submit" type="button" onClick={loadWallet}>Retry loading wallet</button>}
        {message && <p className="wallet-message wallet-success" role="status">{message}</p>}
        <button className="wallet-submit" disabled={submitting || loading}>
          {submitting ? 'Submitting…' : 'Submit withdrawal'}
        </button>
      </form>

      <section className="withdrawal-history">
        <h3>Withdrawal history</h3>
        {loading ? <p className="wallet-empty">Loading history…</p> : withdrawals.length === 0 ? (
          <p className="wallet-empty">No withdrawals yet.</p>
        ) : (
          <ul>
            {withdrawals.map((item) => (
              <li className="withdrawal-item" key={item.id}>
                <div className="withdrawal-item-top">
                  <strong>{formatUsd(item.amount_usd)}</strong>
                  <span className={`withdrawal-status status-${item.status}`}>{item.status.replaceAll('_', ' ')}</span>
                </div>
                <p>{item.network} · {item.wallet_address}</p>
                {item.transaction_hash && <p className="withdrawal-txid">TXID: {item.transaction_hash}</p>}
                {item.rejection_reason && <p>{item.rejection_reason}</p>}
                {['pending', 'under_review'].includes(item.status) && (
                  <button className="cancel-withdrawal" onClick={() => cancelWithdrawal(item.id)} type="button">
                    Cancel request
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

export default Wallet
