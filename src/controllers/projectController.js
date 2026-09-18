const Project = require('../models/Project');
const Ticket = require('../models/Ticket');
const Client = require('../models/Client');
const { getPagination } = require('../utils/pagination');

// @desc    Get all projects for company (optionally filter by client, paginated)
// @route   GET /api/projects
// @access  Private
const getProjects = async (req, res, next) => {
  try {
    const { client, status, search } = req.query;
    const filter = { company: req.user.company };
    if (client) filter.client = client;
    if (status) filter.status = status;
    if (search) filter.name = { $regex: search, $options: 'i' };

    const { limit, skip, buildResult } = getPagination(req.query, 12);
    const [projects, total] = await Promise.all([
      Project.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('client', 'name')
        .populate('members', 'name avatarColor'),
      Project.countDocuments(filter),
    ]);

    const withCounts = await Promise.all(
      projects.map(async (p) => {
        const openTickets = await Ticket.countDocuments({
          project: p._id,
          status: { $in: ['open', 'in_progress', 'in_review', 'reopened'] },
        });
        const totalTickets = await Ticket.countDocuments({ project: p._id });
        return { ...p.toObject(), openTickets, totalTickets };
      })
    );

    res.json(buildResult(withCounts, total));
  } catch (error) {
    next(error);
  }
};

// @desc    Get single project
// @route   GET /api/projects/:id
// @access  Private
const getProject = async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, company: req.user.company })
      .populate('client', 'name email contactPerson')
      .populate('members', 'name avatarColor email')
      .populate('createdBy', 'name');
    if (!project) {
      res.status(404);
      throw new Error('Project not found');
    }
    const tickets = await Ticket.find({ project: project._id })
      .sort({ createdAt: -1 })
      .populate('assignedTo', 'name avatarColor')
      .populate('reportedBy', 'name avatarColor');

    res.json({ ...project.toObject(), tickets });
  } catch (error) {
    next(error);
  }
};

// @desc    Create project
// @route   POST /api/projects
// @access  Private
const createProject = async (req, res, next) => {
  try {
    const { client, name, description, techStack, repoUrl, liveUrl, status, startDate, deadline, members } =
      req.body;

    if (!client || !name) {
      res.status(400);
      throw new Error('Client and project name are required');
    }

    const clientDoc = await Client.findOne({ _id: client, company: req.user.company });
    if (!clientDoc) {
      res.status(404);
      throw new Error('Client not found');
    }

    const project = await Project.create({
      company: req.user.company,
      client,
      name,
      description,
      techStack: techStack || [],
      repoUrl,
      liveUrl,
      status: status || 'planning',
      startDate,
      deadline,
      members: members || [],
      createdBy: req.user._id,
    });

    const populated = await project.populate('client', 'name');
    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
};

// @desc    Update project
// @route   PUT /api/projects/:id
// @access  Private
const updateProject = async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, company: req.user.company });
    if (!project) {
      res.status(404);
      throw new Error('Project not found');
    }
    const fields = [
      'name',
      'description',
      'techStack',
      'repoUrl',
      'liveUrl',
      'status',
      'startDate',
      'deadline',
      'members',
      'client',
      'publicFormEnabled',
    ];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) project[f] = req.body[f];
    });
    await project.save();
    const populated = await project.populate('client', 'name');
    res.json(populated);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete project
// @route   DELETE /api/projects/:id
// @access  Private
const deleteProject = async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, company: req.user.company });
    if (!project) {
      res.status(404);
      throw new Error('Project not found');
    }
    await Ticket.deleteMany({ project: project._id });
    await project.deleteOne();
    res.json({ message: 'Project and related tickets removed' });
  } catch (error) {
    next(error);
  }
};

// @desc    Regenerate a project's public form token (invalidates the old embed link)
// @route   POST /api/projects/:id/regenerate-public-token
// @access  Private
const regeneratePublicToken = async (req, res, next) => {
  try {
    const crypto = require('crypto');
    const project = await Project.findOne({ _id: req.params.id, company: req.user.company });
    if (!project) {
      res.status(404);
      throw new Error('Project not found');
    }
    project.publicToken = crypto.randomBytes(12).toString('hex');
    await project.save();
    res.json({ publicToken: project.publicToken });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  regeneratePublicToken,
};
