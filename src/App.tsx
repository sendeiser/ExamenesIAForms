import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import DashboardPage from './pages/DashboardPage';
import FormBuilderPage from './pages/FormBuilderPage';
import FormViewPage from './pages/FormViewPage';
import ResponsesPage from './pages/ResponsesPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ExamResultsPage from './pages/ExamResultsPage';
import LoginPage from './pages/LoginPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/view/:formId" element={<FormViewPage />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/form/:formId" element={<FormBuilderPage />} />
        <Route path="/form/:formId/responses" element={<ResponsesPage />} />
        <Route path="/form/:formId/analytics" element={<AnalyticsPage />} />
        <Route path="/form/:formId/exam-results" element={<ExamResultsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
