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
