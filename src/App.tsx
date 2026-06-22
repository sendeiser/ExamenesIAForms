import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import FormBuilderPage from './pages/FormBuilderPage';
import FormViewPage from './pages/FormViewPage';
import ResponsesPage from './pages/ResponsesPage';
import AnalyticsPage from './pages/AnalyticsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<DashboardPage />} />
      <Route path="/form/:formId" element={<FormBuilderPage />} />
      <Route path="/form/:formId/responses" element={<ResponsesPage />} />
      <Route path="/form/:formId/analytics" element={<AnalyticsPage />} />
      <Route path="/view/:formId" element={<FormViewPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
