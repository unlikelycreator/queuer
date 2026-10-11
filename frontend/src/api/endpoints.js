import api, { publicApi } from './axios';

// Auth
export const registerOwner = (data) => api.post('/auth/register', data);
export const joinCompany = (data) => api.post('/auth/join', data);
export const login = (data) => api.post('/auth/login', data);
export const verifyTwoFactorLogin = (data) => api.post('/auth/2fa/verify', data);
export const googleAuth = (data) => api.post('/auth/google', data);
export const getMe = () => api.get('/auth/me');
export const updateMe = (data) => api.put('/auth/me', data);
export const changePassword = (data) => api.put('/auth/password', data);
export const forgotPassword = (data) => publicApi.post('/auth/forgot-password', data);
export const checkResetToken = (token) => publicApi.get(`/auth/reset-password/${token}`);
export const resetPassword = (token, data) => publicApi.post(`/auth/reset-password/${token}`, data);
export const setupTwoFactor = () => api.post('/auth/2fa/setup');
export const enableTwoFactor = (data) => api.post('/auth/2fa/enable', data);
export const disableTwoFactor = (data) => api.post('/auth/2fa/disable', data);
export const regenerateBackupCodes = (data) => api.post('/auth/2fa/backup-codes', data);

// Users
export const getUsers = () => api.get('/users');
export const createUser = (data) => api.post('/users', data);
export const updateUser = (id, data) => api.put(`/users/${id}`, data);
export const deleteUser = (id) => api.delete(`/users/${id}`);
export const regenerateInviteCode = () => api.post('/users/invite-code/regenerate');
export const transferOwnership = (id) => api.post(`/users/${id}/transfer-ownership`);

// Clients
export const getClients = (params) => api.get('/clients', { params });
export const getClient = (id) => api.get(`/clients/${id}`);
export const createClient = (data) => api.post('/clients', data);
export const updateClient = (id, data) => api.put(`/clients/${id}`, data);
export const deleteClient = (id) => api.delete(`/clients/${id}`);

// Projects
export const getProjects = (params) => api.get('/projects', { params });
export const getProject = (id) => api.get(`/projects/${id}`);
export const createProject = (data) => api.post('/projects', data);
export const updateProject = (id, data) => api.put(`/projects/${id}`, data);
export const deleteProject = (id) => api.delete(`/projects/${id}`);
export const regenerateProjectPublicToken = (id) => api.post(`/projects/${id}/regenerate-public-token`);

// Todos
export const getProjectTodos = (projectId, params) => api.get(`/projects/${projectId}/todos`, { params });
export const createTodo = (projectId, data) => api.post(`/projects/${projectId}/todos`, data);
export const updateTodo = (id, data) => api.put(`/todos/${id}`, data);
export const deleteTodo = (id) => api.delete(`/todos/${id}`);
export const getMyDay = (params) => api.get('/todos/my-day', { params });

// Tickets
export const getTickets = (params) => api.get('/tickets', { params });
export const getTicketCounts = (params) => api.get('/tickets/counts', { params });
export const getTicket = (id) => api.get(`/tickets/${id}`);
export const createTicket = (data) => api.post('/tickets', data);
export const updateTicket = (id, data) => api.put(`/tickets/${id}`, data);
export const bulkUpdateTickets = (data) => api.post('/tickets/bulk', data);
export const addTicketUpdate = (id, data) => api.post(`/tickets/${id}/updates`, data);
export const addTicketFiles = (id, data) => api.post(`/tickets/${id}/files`, data);
export const replyToTicket = (id, data) => api.post(`/tickets/${id}/reply`, data);
export const deleteTicket = (id) => api.delete(`/tickets/${id}`);

// Dashboard
export const getDashboard = () => api.get('/dashboard');

// Company settings
export const getCompany = () => api.get('/company');
export const updateCompany = (data) => api.put('/company', data);
export const testImapConnection = (data) => api.post('/company/test-imap-connection', data);
export const testSmtp = () => api.post('/company/test-smtp');
export const checkEmailNow = () => api.post('/company/check-email-now');
export const regenerateEmailSecret = () => api.post('/company/email-secret/regenerate');

// File uploads (protected)
export const uploadFiles = (formData) =>
  api.post('/uploads', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

// Global search
export const globalSearch = (q) => api.get('/search', { params: { q } });

// Public (unauthenticated) endpoints — no token attached
export const getPortal = (token) => publicApi.get(`/public/portal/${token}`);
export const getPortalTickets = (token, params) => publicApi.get(`/public/portal/${token}/tickets`, { params });
export const getPortalTodos = (token, params) => publicApi.get(`/public/portal/${token}/todos`, { params });
export const submitPortalTicket = (token, data) => publicApi.post(`/public/portal/${token}/tickets`, data);
export const getPublicForm = (token) => publicApi.get(`/public/forms/${token}`);
export const submitPublicForm = (token, data) => publicApi.post(`/public/forms/${token}/submit`, data);
export const uploadPublicFiles = (formData) =>
  publicApi.post('/public/uploads', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const getPublicTicket = (token) => publicApi.get(`/public/tickets/${token}`);
export const addPublicComment = (token, data) => publicApi.post(`/public/tickets/${token}/comments`, data);

// Workspace & billing settings
export const getWorkspace = () => api.get('/company/workspace');
export const updateWorkspace = (data) => api.put('/company/workspace', data);
export const applyWorkspaceTemplate = (data) => api.post('/company/workspace/template', data);
export const updateBilling = (data) => api.put('/company/billing', data);

// Ticket checklist
export const addChecklistItem = (id, data) => api.post(`/tickets/${id}/checklist`, data);
export const updateChecklistItem = (id, itemId, data) => api.put(`/tickets/${id}/checklist/${itemId}`, data);
export const deleteChecklistItem = (id, itemId) => api.delete(`/tickets/${id}/checklist/${itemId}`);

// Time tracking
export const getTimeEntries = (params) => api.get('/time', { params });
export const getRunningTimer = () => api.get('/time/running');
export const getTimeSummary = (params) => api.get('/time/summary', { params });
export const startTimer = (data) => api.post('/time/start', data);
export const stopTimer = () => api.post('/time/stop');
export const createTimeEntry = (data) => api.post('/time', data);
export const updateTimeEntry = (id, data) => api.put(`/time/${id}`, data);
export const deleteTimeEntry = (id) => api.delete(`/time/${id}`);

// Invoices
export const getInvoices = (params) => api.get('/invoices', { params });
export const getUnbilled = (params) => api.get('/invoices/unbilled', { params });
export const getInvoice = (id) => api.get(`/invoices/${id}`);
export const createInvoice = (data) => api.post('/invoices', data);
export const updateInvoice = (id, data) => api.put(`/invoices/${id}`, data);
export const deleteInvoice = (id) => api.delete(`/invoices/${id}`);
export const addInvoicePayment = (id, data) => api.post(`/invoices/${id}/payments`, data);
export const deleteInvoicePayment = (id, paymentId) => api.delete(`/invoices/${id}/payments/${paymentId}`);
export const sendInvoice = (id, data) => api.post(`/invoices/${id}/send`, data);
export const getInvoicePdf = (id) => api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
export const getPublicInvoice = (token) => publicApi.get(`/public/invoices/${token}`);

// Automations
export const getAutomations = () => api.get('/automations');
export const createAutomation = (data) => api.post('/automations', data);
export const updateAutomation = (id, data) => api.put(`/automations/${id}`, data);
export const deleteAutomation = (id) => api.delete(`/automations/${id}`);
export const testAutomation = (id, data) => api.post(`/automations/${id}/test`, data);

// Reports
export const getReport = (params) => api.get('/reports/overview', { params });
export const exportReport = (params) => api.get('/reports/export', { params, responseType: 'blob' });

// Activity, notifications, saved replies
export const getActivity = (params) => api.get('/activity', { params });
export const getNotifications = () => api.get('/notifications');
export const getUnreadCount = () => api.get('/notifications/unread');
export const markNotificationsRead = (id) => api.post(id ? `/notifications/${id}/read` : '/notifications/read');
export const getSavedReplies = () => api.get('/saved-replies');
export const createSavedReply = (data) => api.post('/saved-replies', data);
export const updateSavedReply = (id, data) => api.put(`/saved-replies/${id}`, data);
export const deleteSavedReply = (id) => api.delete(`/saved-replies/${id}`);
export const useSavedReply = (id) => api.post(`/saved-replies/${id}/use`);

// Public CSAT
export const submitCsat = (token, data) => publicApi.post(`/public/tickets/${token}/csat`, data);
