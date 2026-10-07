const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;

  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 404;
    message = 'Resource not found';
  }

  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue || {})[0];
    message = `Duplicate value for field: ${field}`;
  }

  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((val) => val.message)
      .join(', ');
  }

  if (err.name === 'MulterError' || err.message === 'File type not allowed') {
    statusCode = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 15MB)' : err.message;
  }

  if (err.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Request is too large';
  }

  if (statusCode >= 500) {
    console.error(err);
    if (process.env.NODE_ENV === 'production') message = 'Something went wrong. Please try again.';
  }

  res.status(statusCode).json({
    message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
};

module.exports = { notFound, errorHandler };
