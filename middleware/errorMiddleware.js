// middleware/errorMiddleware.js

function errorHandler(err, req, res, next) {
    const statusCode = err.statusCode || 500; // Default to 500 if no status code is provided
    const message = err.message || 'Internal Server Error';
    const data = err.data || null;

    // Log the error (optional, for debugging purposes)
    console.error('Error: ', {
        message: err.message,
        stack: err.stack,
        data: err.data,
    });

    res.status(statusCode).json({
        message,
        ...(data && { data }) // Include data if it's provided
    });
}

function createError(statusCode, message, data = null) {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.data = data;
    return error;
}

module.exports = {
    errorHandler,
    createError,
};
