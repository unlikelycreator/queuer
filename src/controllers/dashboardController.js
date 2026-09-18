const Client = require('../models/Client');
const Project = require('../models/Project');
const Ticket = require('../models/Ticket');
const User = require('../models/User');

// @desc    Get dashboard stats/overview
// @route   GET /api/dashboard
// @access  Private
const getDashboard = async (req, res, next) => {
  try {
    const company = req.user.company;

    const [totalClients, totalProjects, totalTickets, totalUsers] = await Promise.all([
      Client.countDocuments({ company }),
      Project.countDocuments({ company }),
      Ticket.countDocuments({ company }),
      User.countDocuments({ company }),
    ]);

    const ticketsByStatus = await Ticket.aggregate([
      { $match: { company } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const ticketsByType = await Ticket.aggregate([
      { $match: { company } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]);

    const ticketsByPriority = await Ticket.aggregate([
      { $match: { company }, },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]);

    const recentTickets = await Ticket.find({ company })
      .sort({ createdAt: -1 })
      .limit(8)
      .populate('client', 'name')
      .populate('project', 'name')
      .populate('assignedTo', 'name avatarColor');

    const recentProjects = await Project.find({ company })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('client', 'name');

    const openCritical = await Ticket.countDocuments({
      company,
      priority: 'critical',
      status: { $nin: ['resolved', 'closed'] },
    });

    const myOpenTickets = await Ticket.countDocuments({
      company,
      assignedTo: req.user._id,
      status: { $nin: ['resolved', 'closed'] },
    });

    const statusMap = { open: 0, in_progress: 0, in_review: 0, resolved: 0, closed: 0, reopened: 0 };
    ticketsByStatus.forEach((s) => (statusMap[s._id] = s.count));

    const typeMap = { bug_report: 0, feature_request: 0, change_request: 0, support_ticket: 0 };
    ticketsByType.forEach((t) => (typeMap[t._id] = t.count));

    const priorityMap = { low: 0, medium: 0, high: 0, critical: 0 };
    ticketsByPriority.forEach((p) => (priorityMap[p._id] = p.count));

    res.json({
      totals: { totalClients, totalProjects, totalTickets, totalUsers },
      statusMap,
      typeMap,
      priorityMap,
      recentTickets,
      recentProjects,
      openCritical,
      myOpenTickets,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getDashboard };
