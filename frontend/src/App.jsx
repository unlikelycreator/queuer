import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import AppLayout from '@/components/layout/AppLayout';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import { LogoMark } from '@/components/shared/Logo';

// Route-level code splitting keeps the first load small.
const Login = lazy(() => import('@/pages/Login'));
const Signup = lazy(() => import('@/pages/Signup'));
const Join = lazy(() => import('@/pages/Join'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Clients = lazy(() => import('@/pages/Clients'));
const ClientDetail = lazy(() => import('@/pages/ClientDetail'));
const Projects = lazy(() => import('@/pages/Projects'));
const ProjectDetail = lazy(() => import('@/pages/ProjectDetail'));
const Tickets = lazy(() => import('@/pages/Tickets'));
const TicketDetail = lazy(() => import('@/pages/TicketDetail'));
const Team = lazy(() => import('@/pages/Team'));
const Settings = lazy(() => import('@/pages/Settings'));
const Account = lazy(() => import('@/pages/Account'));
const Portal = lazy(() => import('@/pages/Portal'));
const PublicForm = lazy(() => import('@/pages/PublicForm'));
const PublicTicketStatus = lazy(() => import('@/pages/PublicTicketStatus'));
const NotFound = lazy(() => import('@/pages/NotFound'));

function FullScreenLoader() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
      <LogoMark className="h-10 w-10 animate-pulse" />
      <div className="h-1 w-24 overflow-hidden rounded-full bg-secondary">
        <div className="h-full w-1/2 animate-[shimmer_1.2s_linear_infinite] rounded-full bg-primary [background-size:200%_100%]" />
      </div>
    </div>
  );
}

function PageLoader() {
  return (
    <div className="flex h-[50vh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (user) return <Navigate to="/" replace />;
  return children;
}

function ShellPage({ children }) {
  const location = useLocation();
  return (
    <ErrorBoundary resetKey={location.pathname}>
      <Suspense fallback={<PageLoader />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                fontSize: '14px',
                borderRadius: '12px',
                background: 'hsl(var(--popover))',
                color: 'hsl(var(--popover-foreground))',
                border: '1px solid hsl(var(--border))',
                boxShadow: '0 12px 32px -12px rgba(0,0,0,.25)',
              },
              success: { iconTheme: { primary: 'hsl(152 64% 42%)', secondary: 'white' } },
            }}
          />
          <ErrorBoundary>
            <Suspense fallback={<FullScreenLoader />}>
              <Routes>
                <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
                <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
                <Route path="/join" element={<PublicRoute><Join /></PublicRoute>} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password/:token" element={<ResetPassword />} />

                {/* Public, unauthenticated pages — client portal, embeddable form, ticket tracking */}
                <Route path="/portal/:token" element={<Portal />} />
                <Route path="/public/form/:token" element={<PublicForm />} />
                <Route path="/public/ticket/:token" element={<PublicTicketStatus />} />

                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<ShellPage><Dashboard /></ShellPage>} />
                  <Route path="clients" element={<ShellPage><Clients /></ShellPage>} />
                  <Route path="clients/:id" element={<ShellPage><ClientDetail /></ShellPage>} />
                  <Route path="projects" element={<ShellPage><Projects /></ShellPage>} />
                  <Route path="projects/:id" element={<ShellPage><ProjectDetail /></ShellPage>} />
                  <Route path="tickets" element={<ShellPage><Tickets /></ShellPage>} />
                  <Route path="tickets/:id" element={<ShellPage><TicketDetail /></ShellPage>} />
                  <Route path="team" element={<ShellPage><Team /></ShellPage>} />
                  <Route path="settings" element={<ShellPage><Settings /></ShellPage>} />
                  <Route path="account" element={<ShellPage><Account /></ShellPage>} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
