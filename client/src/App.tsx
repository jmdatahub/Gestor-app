import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SkeletonDashboard } from './components/Skeleton'

// App Components
import AppLayout from './layouts/AppLayout'

// Lazy Pages
const Auth = lazy(() => import('./pages/Auth'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const ProfileSettings = lazy(() => import('./pages/Profile/ProfileSettings'))
const SettingsPage = lazy(() => import('./pages/Settings/SettingsPage'))

// Hub wrappers
const MovimientosHub = lazy(() => import('./pages/Movimientos/MovimientosHub'))
const PatrimonioHub = lazy(() => import('./pages/Patrimonio/PatrimonioHub'))
const AnalisisHub = lazy(() => import('./pages/Analisis/AnalisisHub'))
const ConfigHub = lazy(() => import('./pages/Config/ConfigHub').then(m => ({ default: m.default })))

// Movimientos tab pages
const MovementsList = lazy(() => import('./pages/Movements/MovementsList'))
const RecurringList = lazy(() => import('./pages/Recurring/RecurringList'))
const PendingMovements = lazy(() => import('./pages/Recurring/PendingMovements'))

// Patrimonio tab pages
const AccountsList = lazy(() => import('./pages/Accounts/AccountsList'))
const AccountDetail = lazy(() => import('./pages/Accounts/AccountDetail'))
const SavingsList = lazy(() => import('./pages/Savings/SavingsList'))
const SavingsDetail = lazy(() => import('./pages/Savings/SavingsDetail'))
const InvestmentsList = lazy(() => import('./pages/Investments/InvestmentsList'))
const InvestmentDetail = lazy(() => import('./pages/Investments/InvestmentDetail'))
const DebtsList = lazy(() => import('./pages/Debts/DebtsList'))
const DebtDetail = lazy(() => import('./pages/Debts/DebtDetail'))

// Análisis tab pages
const SummaryPage = lazy(() => import('./pages/Summary/SummaryPage'))
const InsightsPage = lazy(() => import('./pages/Insights/InsightsPage'))
const AlertsList = lazy(() => import('./pages/Alerts/AlertsList'))

// Config tab pages
const CategoriesList = lazy(() => import('./pages/Categories/CategoriesList'))
const ExportPage = lazy(() => import('./pages/Export/ExportPage'))
const OrganizationsList = lazy(() => import('./pages/Organizations/OrganizationsList'))
const OrganizationDetail = lazy(() => import('./pages/Organizations/OrganizationDetail'))
const AdminPanel = lazy(() => import('./pages/Admin/AdminPanel'))

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<SkeletonDashboard />}>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<Navigate to="/app/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="profile" element={<ProfileSettings />} />
            <Route path="settings" element={<SettingsPage />} />

            {/* === Movimientos Hub === */}
            <Route path="movimientos" element={<MovimientosHub />}>
              <Route index element={<MovementsList />} />
              <Route path="recurrentes" element={<RecurringList />} />
              <Route path="pendientes" element={<PendingMovements />} />
            </Route>

            {/* === Patrimonio Hub === */}
            <Route path="patrimonio" element={<PatrimonioHub />}>
              <Route index element={<AccountsList />} />
              <Route path="ahorros" element={<SavingsList />} />
              <Route path="inversiones" element={<InvestmentsList />} />
              <Route path="deudas" element={<DebtsList />} />
            </Route>

            {/* === Análisis Hub === */}
            <Route path="analisis" element={<AnalisisHub />}>
              <Route index element={<SummaryPage />} />
              <Route path="insights" element={<InsightsPage />} />
              <Route path="alertas" element={<AlertsList />} />
            </Route>

            {/* === Configuración Hub === */}
            <Route path="config" element={<ConfigHub />}>
              <Route index element={<Navigate to="categorias" replace />} />
              <Route path="categorias" element={<CategoriesList />} />
              <Route path="exportar" element={<ExportPage />} />
              <Route path="organizaciones" element={<OrganizationsList />} />
              <Route path="admin" element={<AdminPanel />} />
            </Route>

            {/* === Detail routes (not in nav) === */}
            <Route path="accounts/:id" element={<AccountDetail />} />
            <Route path="savings/:id" element={<SavingsDetail />} />
            <Route path="investments/:id" element={<InvestmentDetail />} />
            <Route path="debts/:id" element={<DebtDetail />} />
            <Route path="organizations/:id" element={<OrganizationDetail />} />

            {/* === Backwards-compat redirects === */}
            <Route path="movements" element={<Navigate to="/app/movimientos" replace />} />
            <Route path="recurring" element={<Navigate to="/app/movimientos/recurrentes" replace />} />
            <Route path="pending" element={<Navigate to="/app/movimientos/pendientes" replace />} />
            <Route path="accounts" element={<Navigate to="/app/patrimonio" replace />} />
            <Route path="savings" element={<Navigate to="/app/patrimonio/ahorros" replace />} />
            <Route path="investments" element={<Navigate to="/app/patrimonio/inversiones" replace />} />
            <Route path="debts" element={<Navigate to="/app/patrimonio/deudas" replace />} />
            <Route path="summary" element={<Navigate to="/app/analisis" replace />} />
            <Route path="insights" element={<Navigate to="/app/analisis/insights" replace />} />
            <Route path="alerts" element={<Navigate to="/app/analisis/alertas" replace />} />
            <Route path="categories" element={<Navigate to="/app/config/categorias" replace />} />
            <Route path="export" element={<Navigate to="/app/config/exportar" replace />} />
            <Route path="organizations" element={<Navigate to="/app/config/organizaciones" replace />} />
            <Route path="admin" element={<Navigate to="/app/config/admin" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
