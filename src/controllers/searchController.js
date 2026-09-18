const Client = require('../models/Client');
const Project = require('../models/Project');
const Ticket = require('../models/Ticket');

// @desc    Global search across clients, projects and tickets
// @route   GET /api/search?q=
// @access  Private
const globalSearch = async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ clients: [], projects: [], tickets: [] });

    const company = req.user.company;
    const regex = { $regex: q, $options: 'i' };

    const [clients, projects, tickets] = await Promise.all([
      Client.find({ company, $or: [{ name: regex }, { email: regex }, { contactPerson: regex }] })
        .limit(5)
        .select('name'),
      Project.find({ company, name: regex }).limit(5).select('name client').populate('client', 'name'),
      Ticket.find({ company, $or: [{ title: regex }, { description: regex }] })
        .limit(6)
        .select('title ticketNumber type status')
        .sort({ createdAt: -1 }),
    ]);

    res.json({ clients, projects, tickets });
  } catch (error) {
    next(error);
  }
};

module.exports = { globalSearch };
