const express = require('express');
const auth = require('./authentication/authentication')
const router = express.Router();

// authentication
router.post('/login', auth.loginUser);
router.get('/user', auth.getUserDetails);

module.exports = router;
