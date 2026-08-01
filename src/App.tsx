import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import BorrowForm from './pages/BorrowForm';
import Login from './pages/admin/Login';
import AdminLayout from './pages/admin/AdminLayout';
import ChangePassword from './pages/admin/ChangePassword';
import Dashboard from './pages/admin/Dashboard';
import Inventory from './pages/admin/Inventory';
import Requests from './pages/admin/Requests';
import ActiveBorrows from './pages/admin/ActiveBorrows';
import ReturnHistory from './pages/admin/ReturnHistory';
import BorrowRequestHistory from './pages/admin/BorrowRequestHistory';
import EquipmentPulloutLegacy from './pages/admin/EquipmentPullout';
import PulloutRequests from './pages/admin/PulloutRequests';
import PulloutRequestNew from './pages/admin/PulloutRequestNew';
import PulloutRequestDetail from './pages/admin/PulloutRequestDetail';
import HistoryLogs from './pages/admin/HistoryLogs';
import Categories from './pages/admin/Categories';
import Report from './pages/admin/Report';
import Users from './pages/admin/Users';
import Ministries from './pages/admin/Ministries';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/borrow/:ministrySlug" element={<BorrowForm />} />

        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="change-password" element={<ChangePassword />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="requests" element={<Requests />} />
          <Route path="active" element={<ActiveBorrows />} />
          <Route path="history" element={<ReturnHistory />} />
          <Route path="request-history" element={<BorrowRequestHistory />} />
          <Route path="pullout" element={<PulloutRequests />} />
          <Route path="pullout/new" element={<PulloutRequestNew />} />
          <Route path="pullout/legacy" element={<EquipmentPulloutLegacy />} />
          <Route path="pullout/:id" element={<PulloutRequestDetail />} />
          <Route path="logs" element={<HistoryLogs />} />
          <Route path="categories" element={<Categories />} />
          <Route path="report" element={<Report />} />
          <Route path="users" element={<Users />} />
          <Route path="ministries" element={<Ministries />} />
        </Route>

        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
