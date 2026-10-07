const Counter = require('../models/Counter');

// Atomic per-company ticket sequence (#1, #2, ...).
async function getNextTicketNumber(companyId) {
  const counter = await Counter.findOneAndUpdate(
    { company: companyId },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}

module.exports = { getNextTicketNumber };
