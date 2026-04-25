import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SkeletonDashboard } from './components/Skeleton'

// App Components
import AppLayout from './layouts/AppLayout'

// Lazy Pages
const Auth = lazy(() => import('./pages/Auth'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const DebtsList = lazy(() => import('./pages/Debts/DebtsList'))
const DebtDetail = lazy(() => import('./pages/Debts/DebtDetail'))
const OrganizationsList = lazy(() => import('./pages/Organizations/OrganizationsList'))
const OrganizationDetail = lazy(() => import('./pages/Organizations/OrganizationDetail'))
const MovementsList = lazy(() => import('./pages/Movements/MovementsList'))
const CategoriesList = lazy(() => import('./pages/Categories/CategoriesList'))
const SavingsList = lazy(() => import('./pages/Savings/SavingsList'))
const SavingsDetail = lazy(() => import('./pages/Savings/SavingsDetail'))
const RecurringList = lazy(() => import('./pages/Recurring/RecurringList'))
const PendingMovements = lazy(() => import('./pages/Recurring/PendingMovements'))
const ExportPage = lazy(() => import('./pages/Export/ExportPage'))
const InvestmentsList = lazy(() => import('./pages/Investments/InvestmentsList'))
const InvestmentDetail = lazy(() => import('./pages/Investments/InvestmentDetail'))
const AlertsList = lazy(() => import('./pages/Alerts/AlertsList'))
const AccountsList = lazy(() => import('./pages/Accounts/AccountsList'))
const AccountDetail = lazy(() => import('./pages/Accounts/AccountDetail'))
const InsightsPage = lazy(() => import('./pages/Insights/InsightsPage'))
const SummaryPage = lazy(() => import('./pages/Summary/SummaryPage'))
const SettingsPage = lazy(() => import('./pages/Settings/SettingsPage'))
const AdminPanel = lazy(() => import('./pages/Admin/AdminPanel'))
const ProfileSettings = lazy(() => import('./pages/Profile/ProfileSettings'))

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<SkeletonDashboard />}>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<Navigate to="/app/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="organizations" element={<OrganizationsList />} />
            <Route path="organizations/:id" element={<OrganizationDetail />} />
            <Route path="summary" element={<SummaryPage />} />
            <Route path="movements" element={<MovementsList />} />
            <Route path="categories" element={<CategoriesList />} />
            <Route path="accounts" element={<AccountsList />} />
            <Route path="accounts/:id" element={<AccountDetail />} />
            <Route path="savings" element={<SavingsList />} />
            <Route path="savings/:id" element={<SavingsDetail />} />
            <Route path="investments" element={<InvestmentsList />} />
            <Route path="investments/:id" element={<InvestmentDetail />} />
            <Route path="recurring" element={<RecurringList />} />
            <Route path="pending" element={<PendingMovements />} />
            <Route path="debts" element={<DebtsList />} />
            <Route path="debts/:id" element={<DebtDetail />} />
            <Route path="insights" element={<InsightsPage />} />
            <Route path="alerts" element={<AlertsList />} />
            <Route path="export" element={<ExportPage />} />
            <Route path="admin" element={<AdminPanel />} />
            <Route path="profile" element={<ProfileSettings />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
