const jwt = require('jsonwebtoken');
require('dotenv').config();

const secretKey = process.env.JWT_SECRET_KEY || 'default-secret-key';

function generateToken(payload, options = {}) {
  const defaultOptions = { expiresIn: '1h' };
  return jwt.sign(payload, secretKey, { ...defaultOptions, ...options });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, secretKey);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    } else {
      throw new Error('Token verification failed');
    }
  }
}

function refreshToken(token, options = {}) {
  try {
    const payload = jwt.verify(token, secretKey, { ignoreExpiration: true });
    delete payload.iat;
    delete payload.exp;
    return generateToken(payload, options);
  } catch (error) {
    throw new Error('Token refresh failed');
  }
}

function authenticateUser(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    logger.warn('Authorization token missing');
    return res.status(401).json({ message: 'Authorization token is required' });
  }
  try {
    const decoded = verifyToken(token);
    logger.info('User authenticated successfully', { user: decoded });
    req.user = decoded;
    next();
  } catch (error) {
    logger.error('Authentication failed', { error });
    res.status(401).json({ message: error.message });
  }
}

module.exports = { generateToken, verifyToken, refreshToken, authenticateUser };
