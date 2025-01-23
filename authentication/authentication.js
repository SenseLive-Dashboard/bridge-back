const bcrypt = require('bcrypt');
const db = require('../db');
const jwtUtils = require('../token/jwtUtils');
const { v4: uuidv4 } = require('uuid');

async function register(req, res) {
    const {
        FirstName,
        LastName,
        PersonalEmail,
        UserType,
        Password
    } = req.body;

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
            return res.status(409).json({ message: 'User Already Exists!' });
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
        console.error('Error during registration:', error);
        res.status(500).json({ message: 'Internal server error' });

    } finally {
        client.release();
    }
}

async function loginUser(req, res) {
  const { Username, Password } = req.body;
  const checkUserNameQuery = `SELECT * FROM bridge.bridge_user_info WHERE "personal_email" = $1`;

  try {
    const checkUserNameResult = await db.query(checkUserNameQuery, [Username]);

    if (checkUserNameResult.rows.length === 0) {
      return res.status(401).json({ message: 'Username not found' });
    }

    const user = checkUserNameResult.rows[0];

    if (user.verified === 0) {
      return res.status(401).json({ message: 'User is not verified. Please verify your account.' });
    }

    const passwordCheckResult = await bcrypt.compare(Password, user.password);
    if (!passwordCheckResult) {
      return res.status(402).json({ message: 'Invalid credentials' });
    }

    const jwtToken = jwtUtils.generateToken({ userName: Username });
    res.status(200).json({ message: 'Login successful', token: jwtToken });

  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Internal server error', error });
  }
}

async function getUserDetails(req, res) {
  try {
    if (!req.headers.authorization) {
      console.log('Authorization header missing');
      return res.status(401).json({ message: 'Authorization header missing' });
    }

    const token = req.headers.authorization.split(' ')[1];

    const decodedToken = jwtUtils.verifyToken(token);
    if (!decodedToken) {
      console.log('Invalid Token');
      return res.status(401).json({ message: 'Invalid token' });
    }

    const fetchUserQuery = 'SELECT user_id, first_name, last_name, user_type, organization_id  FROM bridge.bridge_user_info WHERE "personal_email" = $1';

    const userResult = await db.query(fetchUserQuery, [decodedToken.userName]);

    if (userResult.rowCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userDetail = userResult.rows[0];
    return res.status(200).json(userDetail);
  } catch (error) {
    console.error('Error during fetching details:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
} 

module.exports = {
  register,
  loginUser,
  getUserDetails
};