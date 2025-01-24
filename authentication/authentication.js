const bcrypt = require('bcrypt');
const db = require('../db');
const jwtUtils = require('../token/jwtUtils');
const { v4: uuidv4 } = require('uuid');
const { createError } = require('../middleware/errorMiddleware');

async function register(req, res, next) {
  const { FirstName, LastName, PersonalEmail, UserType, Password } = req.body;
  const user_id = uuidv4();
  const password_hash = await bcrypt.hash(Password, 10);
  const verificationToken = jwtUtils.generateToken({ personalemail: PersonalEmail });

  const client = await db.connect();

  try {
      await client.query('BEGIN');

      const CheckUserExistQuery = `SELECT * FROM bridge.bridge_user_info WHERE personal_email = $1;`;
      const userResult = await client.query(CheckUserExistQuery, [PersonalEmail]);

      if (userResult.rows.length > 0) {
          await client.query('ROLLBACK');
          throw createError(409, 'User Already Exists!');
      }

      const InsertUserQuery = `
          INSERT INTO bridge.bridge_user_info 
          (user_id, first_name, last_name, personal_email, user_type, password, verified, verification_token) 
          VALUES($1, $2, $3, $4, $5, $6, $7, $8);
      `;
      await client.query(InsertUserQuery, [
          user_id, FirstName, LastName, PersonalEmail, UserType, password_hash, 0, verificationToken
      ]);

      await client.query('COMMIT');
      res.status(201).json({ message: 'User registered successfully' });

  } catch (error) {
      await client.query('ROLLBACK');
      next(error); // Pass the error to the error handling middleware
  } finally {
      client.release();
  }
}

async function loginUser(req, res, next) {
  const { Username, Password } = req.body;
  const checkUserNameQuery = `SELECT * FROM bridge.bridge_user_info WHERE "personal_email" = $1`;

  try {
      const checkUserNameResult = await db.query(checkUserNameQuery, [Username]);

      if (checkUserNameResult.rows.length === 0) {
          throw createError(401, 'Username not found');
      }

      const user = checkUserNameResult.rows[0];

      if (user.verified === 0) {
          throw createError(401, 'User is not verified. Please verify your account.');
      }
      

      const passwordCheckResult = await bcrypt.compare(Password, user.password);
      if (!passwordCheckResult) {
          throw createError(402, 'Invalid credentials');
      }

      const jwtToken = jwtUtils.generateToken({ userName: Username });
      res.status(200).json({ message: 'Login successful', token: jwtToken });

  } catch (error) {
      next(error); // Pass the error to the error handling middleware
  }
}

async function getUserDetails(req, res, next) {
  try {
      if (!req.headers.authorization) {
          throw createError(401, 'Authorization header missing');
      }

      const token = req.headers.authorization.split(' ')[1];
      const decodedToken = jwtUtils.verifyToken(token);

      if (!decodedToken) {
          throw createError(401, 'Invalid token');
      }

      const fetchUserQuery = 'SELECT user_id, first_name, last_name, user_type FROM bridge.bridge_user_info WHERE "personal_email" = $1';
      const userResult = await db.query(fetchUserQuery, [decodedToken.userName]);

      if (userResult.rowCount === 0) {
          throw createError(404, 'User not found');
      }

      const userDetail = userResult.rows[0];
      res.status(200).json({ message: 'User details fetched successfully', data: userDetail });
  } catch (error) {
      next(error); 
  }
}

module.exports = {
  register,
  loginUser,
  getUserDetails
};