const Client = require('../models/Client');
const Project = require('../models/Project');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const Todo = require('../models/Todo');

const ACTIVE = ['open', 'in_progress', 'in_review', 'reopened'];

// @desc    Get dashboard stats/overview
// @route   GET /api/dashboard
const getDashboard = async (req, res, next) => {
  try {
    const company = req.user.company;
    const DAYS = 14;
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (DAYS - 1));
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const [
      totalClients,
      totalProjects,
      totalTickets,
      totalUsers,
      ticketsByStatus,
      ticketsByType,
      ticketsByPriority,
      createdTrend,
      resolvedTrend,
      resolution,
      recentTickets,
      recentProjects,
      openCritical,
      myOpenTickets,
      awaitingReply,
      overdueTickets,
      todayTodos,
      workload,
    ] = await Promise.all([
      Client.countDocuments({ company }),
      Project.countDocuments({ company }),
      Ticket.countDocuments({ company }),
      User.countDocuments({ company }),
      Ticket.aggregate([{ $match: { company } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Ticket.aggregate([{ $match: { company } }, { $group: { _id: '$type', count: { $sum: 1 } } }]),
      Ticket.aggregate([
        { $match: { company, status: { $in: ACTIVE } } },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]),
      Ticket.find({ company, createdAt: { $gte: since } }).select('createdAt').limit(10000).lean(),
      Ticket.find({ company, resolvedAt: { $gte: since } }).select('resolvedAt').limit(10000).lean(),
      Ticket.find({ company, resolvedAt: { $ne: null }, createdAt: { $gte: new Date(Date.now() - 90 * 864e5) } })
        .select('createdAt resolvedAt')
        .sort({ resolvedAt: -1 })
        .limit(1000)
        .lean(),
      Ticket.find({ company })
        .select('-updates')
        .sort({ lastActivityAt: -1, createdAt: -1 })
        .limit(8)
        .populate('client', 'name')
        .populate('project', 'name')
        .populate('assignedTo', 'name avatarColor avatarUrl'),
      Project.find({ company, status: { $nin: ['completed', 'cancelled'] } })
        .sort({ updatedAt: -1 })
        .limit(5)
        .populate('client', 'name'),
      Ticket.countDocuments({ company, priority: 'critical', status: { $in: ACTIVE } }),
      Ticket.countDocuments({ company, assignedTo: req.user._id, status: { $in: ACTIVE } }),
      Ticket.countDocuments({ company, awaitingTeamReply: true }),
      Ticket.countDocuments({ company, status: { $in: ACTIVE }, dueDate: { $lt: new Date() } }),
      Todo.aggregate([
        { $match: { company, date: today } },
        { $group: { _id: '$completed', count: { $sum: 1 } } },
      ]),
      Ticket.aggregate([
        { $match: { company, status: { $in: ACTIVE }, assignedTo: { $ne: null } } },
        { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 6 },
      ]),
    ]);

    const statusMap = { open: 0, in_progress: 0, in_review: 0, resolved: 0, closed: 0, reopened: 0 };
    ticketsByStatus.forEach((s) => (statusMap[s._id] = s.count));
    const typeMap = {};
    ticketsByType.forEach((t) => (typeMap[t._id] = t.count));
    const priorityMap = { low: 0, medium: 0, high: 0, critical: 0 };
    ticketsByPriority.forEach((p) => (priorityMap[p._id] = p.count));

    const bucket = (rows, field) =>
      rows.reduce((acc, r) => {
        const key = new Date(r[field]).toISOString().slice(0, 10);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
    const cMap = bucket(createdTrend, 'createdAt');
    const rMap = bucket(resolvedTrend, 'resolvedAt');
    const trend = Array.from({ length: DAYS }, (_, i) => {
      const d = new Date(since.getTime() + i * 864e5).toISOString().slice(0, 10);
      return { date: d, created: cMap[d] || 0, resolved: rMap[d] || 0 };
    });

    const openTotal = ACTIVE.reduce((a, s) => a + statusMap[s], 0);
    const avgResolutionMs = resolution.length
      ? resolution.reduce((a, t) => a + (new Date(t.resolvedAt) - new Date(t.createdAt)), 0) / resolution.length
      : null;
    const workloadUsers = await User.find({ _id: { $in: workload.map((w) => w._id) } }).select('name avatarColor avatarUrl');
    const workloadList = workload
      .map((w) => {
        const u = workloadUsers.find((x) => String(x._id) === String(w._id));
        return u ? { _id: u._id, name: u.name, avatarColor: u.avatarColor, avatarUrl: u.avatarUrl, count: w.count } : null;
      })
      .filter(Boolean);
    const todosTotal = todayTodos.reduce((a, t) => a + t.count, 0);
    const todosDone = todayTodos.filter((t) => t._id === true).reduce((a, t) => a + t.count, 0);

    res.json({
      totals: { totalClients, totalProjects, totalTickets, totalUsers, openTickets: openTotal },
      statusMap,
      typeMap,
      priorityMap,
      trend,
      avgResolutionHours: avgResolutionMs === null ? null : Math.round(avgResolutionMs / 36e5),
      resolvedLast90: resolution.length,
      recentTickets,
      recentProjects,
      openCritical,
      myOpenTickets,
      awaitingReply,
      overdueTickets,
      todayTodos: { total: todosTotal, done: todosDone },
      workload: workloadList,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getDashboard };
