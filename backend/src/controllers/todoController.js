const Todo = require('../models/Todo');
const Project = require('../models/Project');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const { isObjectId } = require('../utils/sanitize');

const POPULATE = [
  { path: 'assignedTo', select: 'name avatarColor avatarUrl' },
  { path: 'createdBy', select: 'name' },
  { path: 'completedBy', select: 'name' },
  { path: 'project', select: 'name' },
  { path: 'ticket', select: 'ticketNumber title status' },
];

// "2026-10-07" -> Date at 00:00 UTC. Everything is stored per calendar day so a todo
// planned for the 7th shows up on the 7th regardless of the viewer's timezone.
function parseDay(value) {
  if (!value) return null;
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 86400000);
}

function foldDays(rows) {
  const map = new Map();
  rows.forEach(({ _id, count }) => {
    const key = new Date(_id.date).toISOString();
    const entry = map.get(key) || { date: _id.date, total: 0, done: 0 };
    entry.total += count;
    if (_id.completed) entry.done += count;
    map.set(key, entry);
  });
  return [...map.values()].sort((a, b) => new Date(a.date) - new Date(b.date));
}

async function loadProject(req, res, projectId) {
  if (!isObjectId(projectId)) {
    res.status(404);
    throw new Error('Project not found');
  }
  const project = await Project.findOne({ _id: projectId, company: req.user.company }).select('_id name');
  if (!project) {
    res.status(404);
    throw new Error('Project not found');
  }
  return project;
}

// @desc    List a project's todos in a date range (default: the 7 days around today),
//          plus any overdue, unfinished todos from before the range.
// @route   GET /api/projects/:projectId/todos?from=YYYY-MM-DD&to=YYYY-MM-DD
const getProjectTodos = async (req, res, next) => {
  try {
    const project = await loadProject(req, res, req.params.projectId);
    const today = parseDay(new Date().toISOString());
    const from = parseDay(req.query.from) || addDays(today, -3);
    const to = parseDay(req.query.to) || addDays(today, 3);

    const [todos, overdue, summary] = await Promise.all([
      Todo.find({ project: project._id, date: { $gte: from, $lte: to } })
        .sort({ date: 1, completed: 1, createdAt: 1 })
        .populate(POPULATE),
      Todo.find({ project: project._id, date: { $lt: from < today ? from : today }, completed: false })
        .sort({ date: 1 })
        .limit(50)
        .populate(POPULATE),
      Todo.aggregate([
        { $match: { project: project._id } },
        { $group: { _id: { date: '$date', completed: '$completed' }, count: { $sum: 1 } } },
      ]),
    ]);

    res.json({
      from,
      to,
      todos,
      overdue: overdue.filter((t) => t.date < today),
      // Per-day totals across the whole project, used for the calendar dots.
      days: foldDays(summary),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a todo on a project for a given day
// @route   POST /api/projects/:projectId/todos
const createTodo = async (req, res, next) => {
  try {
    const project = await loadProject(req, res, req.params.projectId);
    const { title, notes, date, priority, assignedTo, ticket } = req.body;
    if (!title?.trim()) {
      res.status(400);
      throw new Error('Todo title is required');
    }
    const day = parseDay(date) || parseDay(new Date().toISOString());

    if (assignedTo && !(await User.exists({ _id: assignedTo, company: req.user.company }))) {
      res.status(400);
      throw new Error('Assignee is not part of your team');
    }
    if (ticket && !(await Ticket.exists({ _id: ticket, project: project._id }))) {
      res.status(400);
      throw new Error('Linked ticket must belong to this project');
    }

    const todo = await Todo.create({
      company: req.user.company,
      project: project._id,
      title: title.trim(),
      notes,
      date: day,
      priority: ['low', 'medium', 'high'].includes(priority) ? priority : 'medium',
      assignedTo: assignedTo || undefined,
      ticket: ticket || undefined,
      createdBy: req.user._id,
    });
    res.status(201).json(await todo.populate(POPULATE));
  } catch (error) {
    next(error);
  }
};

// @desc    Update a todo (toggle done, edit, move to another day)
// @route   PUT /api/todos/:id
const updateTodo = async (req, res, next) => {
  try {
    const todo = await Todo.findOne({ _id: req.params.id, company: req.user.company });
    if (!todo) {
      res.status(404);
      throw new Error('Todo not found');
    }
    const { title, notes, date, priority, assignedTo, completed } = req.body;
    if (title !== undefined) {
      if (!String(title).trim()) {
        res.status(400);
        throw new Error('Todo title is required');
      }
      todo.title = String(title).trim();
    }
    if (notes !== undefined) todo.notes = notes;
    if (date !== undefined) {
      const day = parseDay(date);
      if (!day) {
        res.status(400);
        throw new Error('Invalid date');
      }
      todo.date = day;
    }
    if (priority && ['low', 'medium', 'high'].includes(priority)) todo.priority = priority;
    if (assignedTo !== undefined) {
      if (assignedTo && !(await User.exists({ _id: assignedTo, company: req.user.company }))) {
        res.status(400);
        throw new Error('Assignee is not part of your team');
      }
      todo.assignedTo = assignedTo || undefined;
    }
    if (typeof completed === 'boolean' && completed !== todo.completed) {
      todo.completed = completed;
      todo.completedAt = completed ? new Date() : undefined;
      todo.completedBy = completed ? req.user._id : undefined;
    }
    await todo.save();
    res.json(await todo.populate(POPULATE));
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a todo
// @route   DELETE /api/todos/:id
const deleteTodo = async (req, res, next) => {
  try {
    const todo = await Todo.findOneAndDelete({ _id: req.params.id, company: req.user.company });
    if (!todo) {
      res.status(404);
      throw new Error('Todo not found');
    }
    res.json({ message: 'Todo removed' });
  } catch (error) {
    next(error);
  }
};

// @desc    The current user's todos for a day across every project (dashboard "My day")
// @route   GET /api/todos/my-day?date=YYYY-MM-DD
const getMyDay = async (req, res, next) => {
  try {
    const day = parseDay(req.query.date) || parseDay(new Date().toISOString());
    const mine = { company: req.user.company, $or: [{ assignedTo: req.user._id }, { assignedTo: null, createdBy: req.user._id }] };
    const [todos, overdue] = await Promise.all([
      Todo.find({ ...mine, date: day }).sort({ completed: 1, priority: -1, createdAt: 1 }).populate(POPULATE),
      Todo.find({ ...mine, date: { $lt: day }, completed: false }).sort({ date: 1 }).limit(20).populate(POPULATE),
    ]);
    res.json({ date: day, todos, overdue });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProjectTodos,
  createTodo,
  updateTodo,
  deleteTodo,
  getMyDay,
  parseDay,
};
