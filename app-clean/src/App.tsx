import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Auth from './pages/Auth'
import AppLayout from './layouts/AppLayout'
import Dashboard from './pages/Dashboard'
import DebtsList from './pages/Debts/DebtsList'
import DebtDetail from './pages/Debts/DebtDetail'
import OrganizationsList from './pages/Organizations/OrganizationsList'
import OrganizationDetail from './pages/Organizations/OrganizationDetail'
import MovementsList from './pages/Movements/MovementsList'
import CategoriesList from './pages/Categories/CategoriesList'
import SavingsList from './pages/Savings/SavingsList'
import SavingsDetail from './pages/Savings/SavingsDetail'
import RecurringList from './pages/Recurring/RecurringList'
import PendingMovements from './pages/Recurring/PendingMovements'
import ExportPage from './pages/Export/ExportPage'
import InvestmentsList from './pages/Investments/InvestmentsList'
import InvestmentDetail from './pages/Investments/InvestmentDetail'
import AlertsList from './pages/Alerts/AlertsList'
import AccountsList from './pages/Accounts/AccountsList'
import AccountDetail from './pages/Accounts/AccountDetail'
import InsightsPage from './pages/Insights/InsightsPage'
import SummaryPage from './pages/Summary/SummaryPage'
import SettingsPage from './pages/Settings/SettingsPage'

function App() {
  return (
    <BrowserRouter>
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
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App









