import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { DashboardLayout } from "../components/layout/DashboardLayout";
import { LoadingState } from "../components/common/LoadingState";
import { ProtectedRoute } from "./ProtectedRoute";
import { RoleBasedRoute } from "./RoleBasedRoute";
import { useAuthStore } from "../store/authStore";

const HomePage = lazy(() => import("../pages/HomePage").then((module) => ({ default: module.HomePage })));
const LoginPage = lazy(() => import("../pages/LoginPage").then((module) => ({ default: module.LoginPage })));
const NotFoundPage = lazy(() => import("../pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage })));
const StudentOverviewPage = lazy(() => import("../pages/student/StudentOverviewPage").then((module) => ({ default: module.StudentOverviewPage })));
const StudentBillsPage = lazy(() => import("../pages/student/StudentBillsPage").then((module) => ({ default: module.StudentBillsPage })));
const StudentPaymentsPage = lazy(() => import("../pages/student/StudentPaymentsPage").then((module) => ({ default: module.StudentPaymentsPage })));
const StudentEblPage = lazy(() => import("../pages/student/StudentEblPage").then((module) => ({ default: module.StudentEblPage })));
const StudentHostelDepositPage = lazy(() => import("../pages/student/StudentHostelDepositPage").then((module) => ({ default: module.StudentHostelDepositPage })));
const StudentNocPage = lazy(() => import("../pages/student/StudentNocPage").then((module) => ({ default: module.StudentNocPage })));
const CaretakerOverviewPage = lazy(() => import("../pages/caretaker/CaretakerOverviewPage").then((module) => ({ default: module.CaretakerOverviewPage })));
const CaretakerEblPage = lazy(() => import("../pages/caretaker/CaretakerEblPage").then((module) => ({ default: module.CaretakerEblPage })));
const CaretakerExpensesPage = lazy(() => import("../pages/caretaker/CaretakerExpensesPage").then((module) => ({ default: module.CaretakerExpensesPage })));
const CaretakerHostelExpensePage = lazy(() => import("../pages/caretaker/CaretakerHostelExpensePage").then((module) => ({ default: module.CaretakerHostelExpensePage })));
const CaretakerAdvancesPage = lazy(() => import("../pages/caretaker/CaretakerAdvancesPage").then((module) => ({ default: module.CaretakerAdvancesPage })));
const CaretakerGuestChargePage = lazy(() => import("../pages/caretaker/CaretakerGuestChargePage").then((module) => ({ default: module.CaretakerGuestChargePage })));
const CaretakerConsumptionPage = lazy(() => import("../pages/caretaker/CaretakerConsumptionPage").then((module) => ({ default: module.CaretakerConsumptionPage })));
const CaretakerBillsPage = lazy(() => import("../pages/caretaker/CaretakerBillsPage").then((module) => ({ default: module.CaretakerBillsPage })));
const CaretakerMessBillPerStudentPage = lazy(() => import("../pages/caretaker/CaretakerMessBillPerStudentPage").then((module) => ({ default: module.CaretakerMessBillPerStudentPage })));
const CaretakerPaymentsPage = lazy(() => import("../pages/caretaker/CaretakerPaymentsPage").then((module) => ({ default: module.CaretakerPaymentsPage })));
const CaretakerHostelDepositPage = lazy(() => import("../pages/caretaker/CaretakerHostelDepositPage").then((module) => ({ default: module.CaretakerHostelDepositPage })));
const CaretakerNocPage = lazy(() => import("../pages/caretaker/CaretakerNocPage").then((module) => ({ default: module.CaretakerNocPage })));
const CaretakerChargesPage = lazy(() => import("../pages/caretaker/CaretakerChargesPage").then((module) => ({ default: module.CaretakerChargesPage })));
const CaretakerReportsPage = lazy(() => import("../pages/caretaker/CaretakerReportsPage").then((module) => ({ default: module.CaretakerReportsPage })));
const CaretakerStudentSignupPage = lazy(() => import("../pages/caretaker/CaretakerStudentSignupPage").then((module) => ({ default: module.CaretakerStudentSignupPage })));
const AdminOverviewPage = lazy(() => import("../pages/admin/AdminOverviewPage").then((module) => ({ default: module.AdminOverviewPage })));
const AdminHostelsPage = lazy(() => import("../pages/admin/AdminHostelsPage").then((module) => ({ default: module.AdminHostelsPage })));
const AdminExpensesPage = lazy(() => import("../pages/admin/AdminExpensesPage").then((module) => ({ default: module.AdminExpensesPage })));
const AdminConsumptionPage = lazy(() => import("../pages/admin/AdminConsumptionPage").then((module) => ({ default: module.AdminConsumptionPage })));
const AdminApprovalsPage = lazy(() => import("../pages/admin/AdminApprovalsPage").then((module) => ({ default: module.AdminApprovalsPage })));
const AdminAnalyticsPage = lazy(() => import("../pages/admin/AdminAnalyticsPage").then((module) => ({ default: module.AdminAnalyticsPage })));
const AdminStudentSignupPage = lazy(() => import("../pages/admin/AdminStudentSignupPage").then((module) => ({ default: module.AdminStudentSignupPage })));
const AdminUsersPage = lazy(() => import("../pages/admin/AdminUsersPage").then((module) => ({ default: module.AdminUsersPage })));
const AdminStudentsPage = lazy(() => import("../pages/admin/AdminStudentsPage").then((module) => ({ default: module.AdminStudentsPage })));

function HomeRedirect() {
  const role = useAuthStore((state) => state.user?.role);

  if (role === "student") return <Navigate to="/student" replace />;
  if (role === "caretaker") return <Navigate to="/caretaker" replace />;
  if (role === "dean" || role === "warden") return <Navigate to="/admin" replace />;
  return <Navigate to="/admin" replace />;
}

function WorkspaceRedirect() {
  const token = useAuthStore((state) => state.token);

  if (!token) return <Navigate to="/login" replace />;

  return <HomeRedirect />;
}

function PublicHomeRoute() {
  const token = useAuthStore((state) => state.token);

  if (token) {
    return <WorkspaceRedirect />;
  }

  return <HomePage />;
}

function PublicLoginRoute() {
  const token = useAuthStore((state) => state.token);

  if (token) {
    return <WorkspaceRedirect />;
  }

  return <LoginPage />;
}

export function AppRouter() {
  return (
    <Suspense fallback={<div className="p-6"><LoadingState label="Loading workspace..." /></div>}>
      <Routes>
        <Route path="/" element={<PublicHomeRoute />} />
        <Route path="/login" element={<PublicLoginRoute />} />
        <Route path="/workspace" element={<WorkspaceRedirect />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route element={<RoleBasedRoute allowedRoles={["student"]} />}>
              <Route path="/student" element={<StudentOverviewPage />} />
              <Route path="/student/bills" element={<StudentBillsPage />} />
              <Route path="/student/payments" element={<StudentPaymentsPage />} />
              <Route path="/student/ebl" element={<StudentEblPage />} />
              <Route path="/student/hostel-deposit" element={<StudentHostelDepositPage />} />
              <Route path="/student/noc" element={<StudentNocPage />} />
            </Route>

            <Route element={<RoleBasedRoute allowedRoles={["caretaker"]} />}>
              <Route path="/caretaker" element={<CaretakerOverviewPage />} />
              <Route path="/caretaker/expenses" element={<CaretakerExpensesPage />} />
              <Route path="/caretaker/hostel-expense" element={<CaretakerHostelExpensePage />} />
              <Route path="/caretaker/ebl" element={<CaretakerEblPage />} />
              <Route path="/caretaker/advances" element={<CaretakerAdvancesPage />} />
              <Route path="/caretaker/guest-charge" element={<CaretakerGuestChargePage />} />
              <Route path="/caretaker/consumption" element={<CaretakerConsumptionPage />} />
              <Route path="/caretaker/bills" element={<CaretakerBillsPage />} />
              <Route path="/caretaker/mess-bill-per-student" element={<CaretakerMessBillPerStudentPage />} />
              <Route path="/caretaker/payments" element={<CaretakerPaymentsPage />} />
              <Route path="/caretaker/hostel-deposit" element={<CaretakerHostelDepositPage />} />
              <Route path="/caretaker/noc" element={<CaretakerNocPage />} />
              <Route path="/caretaker/charges" element={<CaretakerChargesPage />} />
              <Route path="/caretaker/reports" element={<CaretakerReportsPage />} />
              <Route path="/caretaker/student-signups" element={<CaretakerStudentSignupPage />} />
            </Route>

            <Route element={<RoleBasedRoute allowedRoles={["admin", "dean", "warden"]} />}>
              <Route path="/admin" element={<AdminOverviewPage />} />
              <Route path="/admin/approvals" element={<AdminApprovalsPage />} />
              <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
            </Route>

            <Route element={<RoleBasedRoute allowedRoles={["admin"]} />}>
              <Route path="/admin/hostels" element={<AdminHostelsPage />} />
              <Route path="/admin/expenses" element={<AdminExpensesPage />} />
              <Route path="/admin/consumption" element={<AdminConsumptionPage />} />
              <Route path="/admin/student-signups" element={<AdminStudentSignupPage />} />
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/admin/students" element={<AdminStudentsPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
