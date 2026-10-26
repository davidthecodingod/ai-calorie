import { useEffect, useState } from 'react'
import { Icon, type IconName } from './components/Icon'
import { Onboarding } from './screens/Onboarding'
import { Home } from './screens/Home'
import { History } from './screens/History'
import { Progress } from './screens/Progress'
import { Settings } from './screens/Settings'
import { Scan, type ScanResult } from './screens/Scan'
import { Result } from './screens/Result'
import { useStore } from './store'
import { todayKey } from './dates'
import type { Analysis, Entry } from './types'

type Tab = 'home' | 'history' | 'progress' | 'settings'

const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: 'home', label: 'Today', icon: 'home' },
  { key: 'history', label: 'History', icon: 'text' },
  { key: 'progress', label: 'Progress', icon: 'chart' },
  { key: 'settings', label: 'You', icon: 'gear' },
]

export default function App() {
  const { ready, error, data } = useStore()
  const [tab, setTab] = useState<Tab>('home')
  const [date, setDate] = useState(todayKey())
  const [scanning, setScanning] = useState(false)
  const [pending, setPending] = useState<ScanResult | null>(null)
  const [opened, setOpened] = useState<Entry | null>(null)

  // Theme follows the saved setting, defaulting to the system preference.
  useEffect(() => {
    const pref = data.settings.theme ?? 'system'
    const root = document.documentElement
    const apply = () => {
      const dark =
        pref === 'dark' ||
        (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      root.setAttribute('data-theme', dark ? 'dark' : 'light')
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', dark ? '#121110' : '#FBF9F6')
    }
    apply()
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [data.settings.theme])

  if (!ready) {
    return (
      <div className="shell">
        <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
          <span className="spinner" style={{ color: 'var(--muted)' }} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="shell">
        <div className="scroll page-pad" style={{ display: 'grid', placeItems: 'center' }}>
          <div className="col" style={{ gap: 14, textAlign: 'center', alignItems: 'center' }}>
            <span style={{ color: 'var(--bad)' }}>
              <Icon name="info" size={36} stroke={1.6} />
            </span>
            <h2 className="h2">Cannot reach the app server</h2>
            <p className="body" style={{ maxWidth: 300 }}>
              {error}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!data.profile) return <Onboarding />

  const openScan = () => setScanning(true)

  return (
    <div className="shell">
      {tab === 'home' && (
        <Home
          date={date}
          onDateChange={setDate}
          onOpenEntry={setOpened}
          onScan={openScan}
        />
      )}
      {tab === 'history' && <History onOpenEntry={setOpened} />}
      {tab === 'progress' && <Progress />}
      {tab === 'settings' && <Settings />}

      <nav className="tabbar">
        {TABS.slice(0, 2).map((t) => (
          <TabButton key={t.key} tab={t} active={tab === t.key} onClick={() => setTab(t.key)} />
        ))}
        <button className="fab" onClick={openScan} aria-label="Scan a meal">
          <Icon name="plus" size={26} stroke={2.2} />
        </button>
        {TABS.slice(2).map((t) => (
          <TabButton key={t.key} tab={t} active={tab === t.key} onClick={() => setTab(t.key)} />
        ))}
      </nav>

      {scanning && (
        <Scan
          onClose={() => setScanning(false)}
          onResult={(r) => {
            setScanning(false)
            setPending(r)
          }}
        />
      )}

      {pending && (
        <Result
          draft={pending.analysis as Analysis}
          image={pending.image}
          source={pending.source}
          date={date}
          onClose={() => setPending(null)}
        />
      )}

      {opened && (
        <Result
          draft={opened}
          existing={opened}
          source={opened.source}
          date={opened.date}
          onClose={() => setOpened(null)}
        />
      )}
    </div>
  )
}

function TabButton({
  tab,
  active,
  onClick,
}: {
  tab: { label: string; icon: IconName }
  active: boolean
  onClick: () => void
}) {
  return (
    <button className="tab" aria-current={active} onClick={onClick}>
      <Icon name={tab.icon} size={21} stroke={active ? 2 : 1.7} />
      {tab.label}
    </button>
  )
}
