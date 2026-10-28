import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { BranchProvider } from './context/BranchContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { StaffLayout } from './layouts/StaffLayout';
import { PatientLayout } from './layouts/PatientLayout';
import { ErrorBoundary } from './components/common/ErrorBoundary';

import { LandingPage } from './pages/LandingPage';
import { PatientLoginPage } from './pages/patient/PatientLoginPage';
import { PatientRegisterPage } from './pages/patient/PatientRegisterPage';
import { PatientDashboard } from './pages/patient/PatientDashboard';
import { PatientAppointmentsPage } from './pages/patient/PatientAppointmentsPage';
import { PatientPrescriptionsPage } from './pages/patient/PatientPrescriptionsPage';
import { PatientLabReportsPage } from './pages/patient/PatientLabReportsPage';
import { PatientBillingPage } from './pages/patient/PatientBillingPage';
import { StaffLoginPage } from './pages/staff/StaffLoginPage';

// All 27 Hospital Modules
import { StaffDashboard } from './pages/staff/StaffDashboard'; // 1. Dashboard
import { PatientsPage } from './pages/staff/PatientsPage'; // 2. Patient Management
import { PatientDetailPage } from './pages/staff/PatientDetailPage'; // 2b. Patient EMR Chart
import { AppointmentsPage } from './pages/staff/AppointmentsPage'; // 3. OPD & Appointments
import { EmergencyPage } from './pages/staff/EmergencyPage'; // 4. Emergency & Casualty
import { AdmissionsPage } from './pages/staff/AdmissionsPage'; // 5. IPD & Admissions
import { DoctorsNursingPage } from './pages/staff/DoctorsNursingPage'; // 6. Doctors & Nursing
import { LaboratoryPage } from './pages/staff/LaboratoryPage'; // 7. Laboratory & Diagnostics
import { RadiologyPage } from './pages/staff/RadiologyPage'; // 8. Radiology & Imaging
import { PharmacyPage } from './pages/staff/PharmacyPage'; // 9. Pharmacy
import { InventoryPage } from './pages/staff/InventoryPage'; // 10. Inventory & Procurement
import { SurgeryICUPage } from './pages/staff/SurgeryICUPage'; // 11. Operation Theatre & ICU
import { BillingPage } from './pages/staff/BillingPage'; // 12. Billing & Payments
import { InsurancePage } from './pages/staff/InsurancePage'; // 13. Insurance & Corporate Billing
import { FinancialAccountsPage } from './pages/staff/FinancialAccountsPage'; // 14. Financial Accounts
import { TransactionsPage } from './pages/staff/TransactionsPage'; // 15. Financial Transactions
import { InvestmentsPage } from './pages/staff/InvestmentsPage'; // 16. Investment Management
import { BankingPage } from './pages/staff/BankingPage'; // 17. Banking & Reconciliation
import { LoansPage } from './pages/staff/LoansPage'; // 18. Loans & Liabilities
import { GeneralLedgerPage } from './pages/staff/GeneralLedgerPage'; // 19. Accounting & General Ledger
import { BudgetingPage } from './pages/staff/BudgetingPage'; // 20. Budgeting & Cash Flow
import { ProfitLossPage } from './pages/staff/ProfitLossPage'; // 21. Profit & Loss Statement
import { HRPayrollPage } from './pages/staff/HRPayrollPage'; // 22. HR & Payroll
import { AssetsPage } from './pages/staff/AssetsPage'; // 23. Equipment & Asset Management
import { PatientPortalGatewayPage } from './pages/staff/PatientPortalGatewayPage'; // 24. Patient Portal Gateway
import { ReportsPage } from './pages/staff/ReportsPage'; // 25. Reports & Analytics
import { UsersRolesPage } from './pages/staff/UsersRolesPage'; // 26. Users, Roles & Permissions
import { SettingsAuditPage } from './pages/staff/SettingsAuditPage'; // 27. Settings & Audit Logs

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <BranchProvider>
          <ErrorBoundary>
            <Routes>
            {/* Public Entry Points */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/patient/login" element={<PatientLoginPage />} />
            <Route path="/patient/register" element={<PatientRegisterPage />} />
            <Route path="/staff/login" element={<StaffLoginPage />} />

            {/* Patient Portal Routes (Module 24: Guarded & Isolated) */}
            <Route
              path="/patient"
              element={
                <ProtectedRoute requirePatient>
                  <PatientLayout />
                </ProtectedRoute>
              }
            >
              <Route path="dashboard" element={<PatientDashboard />} />
              <Route path="appointments" element={<PatientAppointmentsPage />} />
              <Route path="prescriptions" element={<PatientPrescriptionsPage />} />
              <Route path="lab-reports" element={<PatientLabReportsPage />} />
              <Route path="billing" element={<PatientBillingPage />} />
              <Route path="" element={<Navigate to="dashboard" replace />} />
            </Route>

            {/* Staff Portal Routes (All Hospital Management Modules) */}
            <Route
              path="/staff"
              element={
                <ProtectedRoute requireStaff>
                  <StaffLayout />
                </ProtectedRoute>
              }
            >
              {/* 1. Dashboard */}
              <Route path="dashboard" element={<StaffDashboard />} />

              {/* 2. Patient Management */}
              <Route path="patients" element={<PatientsPage />} />
              <Route path="patients/:id" element={<PatientDetailPage />} />

              {/* 3. OPD & Appointments */}
              <Route path="appointments" element={<AppointmentsPage />} />
              <Route path="consultations" element={<AppointmentsPage />} />

              {/* 4. Emergency & Casualty */}
              <Route path="emergency" element={<EmergencyPage />} />

              {/* 5. IPD & Admissions */}
              <Route path="admissions" element={<AdmissionsPage />} />

              {/* 6. Doctors & Nursing */}
              <Route path="doctors-nursing" element={<DoctorsNursingPage />} />

              {/* 7. Laboratory & Diagnostics */}
              <Route path="laboratory" element={<LaboratoryPage />} />

              {/* 8. Radiology & Imaging */}
              <Route path="radiology" element={<RadiologyPage />} />

              {/* 9. Pharmacy */}
              <Route path="pharmacy" element={<PharmacyPage />} />

              {/* 10. Inventory & Procurement */}
              <Route path="inventory" element={<InventoryPage />} />

              {/* 11. Operation Theatre & ICU */}
              <Route path="surgery-icu" element={<SurgeryICUPage />} />

              {/* 12. Billing & Payments */}
              <Route path="billing" element={<BillingPage />} />

              {/* 13. Insurance & Corporate Billing */}
              <Route path="insurance" element={<InsurancePage />} />

              {/* 14. Financial Accounts */}
              <Route path="financial-accounts" element={<FinancialAccountsPage />} />

              {/* 15. Financial Transactions */}
              <Route path="transactions" element={<TransactionsPage />} />

              {/* 16. Investment Management */}
              <Route path="investments" element={<InvestmentsPage />} />

              {/* 17. Banking & Reconciliation */}
              <Route path="banking" element={<BankingPage />} />

              {/* 18. Loans & Liabilities */}
              <Route path="loans" element={<LoansPage />} />

              {/* 19. Accounting & General Ledger */}
              <Route path="general-ledger" element={<GeneralLedgerPage />} />
              <Route path="finance" element={<GeneralLedgerPage />} />

              {/* 20. Budgeting & Cash Flow */}
              <Route path="budgeting" element={<BudgetingPage />} />
              <Route path="cash-flow" element={<BudgetingPage />} />

              {/* 21. Profit and Loss & Financial Reports */}
              <Route path="profit-loss" element={<ProfitLossPage />} />

              {/* 22. HR and Payroll */}
              <Route path="hr-payroll" element={<HRPayrollPage />} />

              {/* 23. Equipment & Asset Management */}
              <Route path="assets" element={<AssetsPage />} />

              {/* 24. Patient Portal Gateway */}
              <Route path="patient-portal" element={<PatientPortalGatewayPage />} />

              {/* 25. Reports & Analytics */}
              <Route path="reports" element={<ReportsPage />} />

              {/* 26. Users, Roles & Permissions */}
              <Route path="users-roles" element={<UsersRolesPage />} />
              <Route path="staff-management" element={<UsersRolesPage />} />

              {/* 27. Settings & Audit Logs */}
              <Route path="settings-audit" element={<SettingsAuditPage />} />
              <Route path="audit" element={<SettingsAuditPage />} />

              {/* Default redirect to Dashboard */}
              <Route path="" element={<Navigate to="dashboard" replace />} />
            </Route>

            {/* Global Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
        </BranchProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
