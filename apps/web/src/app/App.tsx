import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import type { Session } from '../shared/contracts'
import { canManageMembers } from '../shared/contracts'
import { auth, fetchSession, signOutUser } from '../firebase/auth'
import { AuthFlow } from '../auth/AuthScreens'
import { DashboardScreen } from '../dashboard/DashboardScreen'
import { BatchDetail, BatchesScreen } from '../batches/BatchScreens'
import { ChamberDetail, ChambersScreen } from '../chambers/ChamberScreens'
import { IntakeScreen } from '../intake/IntakeScreen'
import { InventoryScreen } from '../inventory/InventoryScreen'
import { AccountScreen } from '../account/AccountScreen'
import { TeamScreen } from '../account/TeamScreen'
import { SettingsScreen } from '../account/SettingsScreen'
import { PendingScreen } from '../account/PendingScreen'
import { FarmersScreen } from '../business/FarmersScreen'
import { SalesScreen } from '../business/SalesScreen'
import { PricingScreen } from '../business/PricingScreen'
import { NotificationsScreen } from '../notifications/NotificationsScreen'
import { identifyOneSignalUser, initOneSignal, logoutOneSignal } from '../notifications/oneSignal'
import { AppShell, type MobileDetailNavigation } from './AppShell'
import { useHistoryRouter } from './useHistoryRouter'
import { useDryo } from './store'

function isRouteAllowed(role: Session['role'], path: string): boolean {
  // Money/admin screens are owner/manager-only (the API enforces this too);
  // every active user may reach the operational screens.
  if (path === '/team' || path === '/farmers' || path === '/pricing' || path === '/settings') return canManageMembers(role)
  return true
}

export function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const { path, navigate, goBack } = useHistoryRouter()
  const [selectedBatchId, setSelectedBatchId] = useState<string>()
  const [selectedChamberId, setSelectedChamberId] = useState<string>()

  const batches = useDryo((state) => state.batches)
  const chambers = useDryo((state) => state.chambers)
  const notifications = useDryo((state) => state.notifications)
  const loadAll = useDryo((state) => state.loadAll)

  useEffect(() => {
    initOneSignal()
    return onAuthStateChanged(auth, (user) => {
      if (!user) {
        setSession(null)
        setAuthReady(true)
        return
      }
      void fetchSession(user)
        .then((next) => {
          setSession(next)
          identifyOneSignalUser(user.uid)
          if (next.status === 'ACTIVE') void loadAll()
        })
        .catch(() => setSession(null))
        .finally(() => setAuthReady(true))
    })
  }, [loadAll])

  if (!authReady) {
    return <div className="auth-screen" aria-busy="true" />
  }

  if (!session) {
    return <AuthFlow />
  }

  if (session.status !== 'ACTIVE') {
    return <PendingScreen session={session} onLogout={() => { void signOutUser(); logoutOneSignal(); navigate('/') }} />
  }

  const firstName = session.displayName.split(' ')[0]
  const currentPath = isRouteAllowed(session.role, path) ? path : '/today'

  const routedBatch = currentPath.startsWith('/batches/')
  const routedChamber = currentPath.startsWith('/chambers/')
  const batchId = routedBatch ? currentPath.split('/')[2] : selectedBatchId
  const chamberId = routedChamber ? currentPath.split('/')[2] : selectedChamberId
  const selectedBatch = batches.find((batch) => batch.id === (batchId ?? batches[0]?.id)) ?? batches[0]
  const selectedChamber = chambers.find((chamber) => chamber.id === (chamberId ?? chambers[0]?.id)) ?? chambers[0]

  const openBatch = (id: string) => {
    setSelectedBatchId(id)
    navigate(`/batches/${id}`)
  }
  const openChamber = (id: string) => {
    setSelectedChamberId(id)
    navigate(`/chambers/${id}`)
  }

  const wide = typeof window !== 'undefined' && window.innerWidth >= 700

  let content
  let detail
  let mobileDetail: MobileDetailNavigation | undefined
  let activePath = currentPath

  if (currentPath === '/notifications') {
    content = <NotificationsScreen />
  } else if (currentPath === '/sales') {
    content = <SalesScreen />
  } else if (currentPath === '/team') {
    activePath = '/account'
    content = <TeamScreen canEditRoles={session.role === 'OWNER'} />
    if (wide === false) mobileDetail = { title: 'Team', onBack: () => goBack('/account') }
  } else if (currentPath === '/farmers') {
    activePath = '/account'
    content = <FarmersScreen />
    if (wide === false) mobileDetail = { title: 'Farmers', onBack: () => goBack('/account') }
  } else if (currentPath === '/pricing') {
    activePath = '/account'
    content = <PricingScreen canEdit={canManageMembers(session.role)} />
    if (wide === false) mobileDetail = { title: 'Pricing', onBack: () => goBack('/account') }
  } else if (currentPath === '/settings') {
    activePath = '/account'
    content = <SettingsScreen />
    if (wide === false) mobileDetail = { title: 'Settings', onBack: () => goBack('/account') }
  } else if (currentPath === '/account') {
    content = <AccountScreen session={session} onNavigate={navigate} onLogout={() => { void signOutUser(); logoutOneSignal(); navigate('/') }} />
  } else if (currentPath.startsWith('/batches')) {
    activePath = '/batches'
    content = <BatchesScreen selectedId={selectedBatch?.id} onSelect={openBatch} />
    if (selectedBatch && (routedBatch || wide)) {
      detail = <BatchDetail key={selectedBatch.id} batch={selectedBatch} />
      if (routedBatch) mobileDetail = { title: 'Batch details', onBack: () => goBack('/batches') }
    }
  } else if (currentPath.startsWith('/chambers')) {
    activePath = '/chambers'
    content = <ChambersScreen selectedId={selectedChamber?.id} onSelect={openChamber} />
    if (selectedChamber && (routedChamber || wide)) {
      detail = <ChamberDetail key={selectedChamber.id} chamber={selectedChamber} />
      if (routedChamber) mobileDetail = { title: 'Chamber details', onBack: () => goBack('/chambers') }
    }
  } else if (currentPath === '/intake') {
    content = <IntakeScreen />
    if (canManageMembers(session.role)) {
      activePath = '/account'
      if (wide === false) mobileDetail = { title: 'Intake', onBack: () => goBack('/account') }
    }
  } else if (currentPath === '/inventory') {
    content = <InventoryScreen canEdit={canManageMembers(session.role)} />
    if (canManageMembers(session.role)) {
      activePath = '/account'
      if (wide === false) mobileDetail = { title: 'Inventory', onBack: () => goBack('/account') }
    }
  } else {
    content = <DashboardScreen role={session.role} firstName={firstName} onOpenBatch={openBatch} onOpenChamber={openChamber} />
  }

  return (
    <AppShell
      role={session.role}
      activePath={activePath}
      onNavigate={navigate}
      userName={session.displayName}
      title={session.houseName}
      notificationCount={notifications.length}
      detail={detail}
      focusDetail={routedBatch || routedChamber}
      mobileDetail={mobileDetail}
    >
      {content}
    </AppShell>
  )
}
