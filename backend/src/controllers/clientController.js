const Client = require('../models/Client');
const Project = require('../models/Project');
const Ticket = require('../models/Ticket');
const { logActivity } = require('../services/activity');
const { escapeRegex } = require('../utils/sanitize');
const { getPagination } = require('../utils/pagination');

// @desc    Get all clients for company (paginated)
// @route   GET /api/clients
// @access  Private
const getClients = async (req, res, next) => {
  try {
    const { search, status } = req.query;
    const filter = { company: req.user.company };
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: escapeRegex(search), $options: 'i' } },
        { email: { $regex: escapeRegex(search), $options: 'i' } },
        { contactPerson: { $regex: escapeRegex(search), $options: 'i' } },
      ];
    }

    const { limit, skip, buildResult } = getPagination(req.query, 12, 500);
    const [clients, total] = await Promise.all([
      Client.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('createdBy', 'name'),
      Client.countDocuments(filter),
    ]);

    const clientsWithCounts = await Promise.all(
      clients.map(async (client) => {
        const projectCount = await Project.countDocuments({ client: client._id });
        const openTickets = await Ticket.countDocuments({
          client: client._id,
          status: { $in: ['open', 'in_progress', 'in_review', 'reopened'] },
        });
        return { ...client.toObject(), projectCount, openTickets };
      })
    );

    res.json(buildResult(clientsWithCounts, total));
  } catch (error) {
    next(error);
  }
};

// @desc    Get single client
// @route   GET /api/clients/:id
// @access  Private
const getClient = async (req, res, next) => {
  try {
    const client = await Client.findOne({ _id: req.params.id, company: req.user.company }).populate(
      'createdBy',
      'name'
    );
    if (!client) {
      res.status(404);
      throw new Error('Client not found');
    }
    const projects = await Project.find({ client: client._id }).sort({ createdAt: -1 });
    res.json({ ...client.toObject(), projects });
  } catch (error) {
    next(error);
  }
};

// @desc    Create client
// @route   POST /api/clients
// @access  Private
const createClient = async (req, res, next) => {
  try {
    const { name, contactPerson, email, phone, companyWebsite, address, notes } = req.body;
    if (!name) {
      res.status(400);
      throw new Error('Client name is required');
    }
    const client = await Client.create({
      company: req.user.company,
      name,
      contactPerson,
      email,
      phone,
      companyWebsite,
      address,
      notes,
      createdBy: req.user._id,
    });
    logActivity({ company: req.user.company, actor: req.user, entityType: 'client', entityId: client._id, entityLabel: client.name, action: 'client.created', summary: `added client ${client.name}`, link: `/clients/${client._id}` });
    res.status(201).json(client);
  } catch (error) {
    next(error);
  }
};

// @desc    Update client
// @route   PUT /api/clients/:id
// @access  Private
const updateClient = async (req, res, next) => {
  try {
    const client = await Client.findOne({ _id: req.params.id, company: req.user.company });
    if (!client) {
      res.status(404);
      throw new Error('Client not found');
    }
    const fields = ['name', 'contactPerson', 'email', 'phone', 'companyWebsite', 'address', 'notes', 'status'];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) client[f] = req.body[f];
    });
    await client.save();
    res.json(client);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete client
// @route   DELETE /api/clients/:id
// @access  Private
const deleteClient = async (req, res, next) => {
  try {
    const client = await Client.findOne({ _id: req.params.id, company: req.user.company });
    if (!client) {
      res.status(404);
      throw new Error('Client not found');
    }
    const projectCount = await Project.countDocuments({ client: client._id });
    if (projectCount > 0) {
      res.status(400);
      throw new Error('Cannot delete client with existing projects. Delete projects first.');
    }
    await client.deleteOne();
    res.json({ message: 'Client removed' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getClients, getClient, createClient, updateClient, deleteClient };
