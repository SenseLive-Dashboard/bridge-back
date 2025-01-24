const express = require('express');
const router = express.Router();

const auth = require('./authentication/authentication');
const broker = require('./controllers/brokerController');
const mapping = require('./controllers/mappingController');
// authentication
router.post('/register', auth.register);
router.post('/login', auth.loginUser);
router.get('/user', auth.getUserDetails);

//broker
router.post('/addBroker', broker.addBroker);
router.delete('/deleteBroker/:id', broker.deleteBroker);
router.post('/testBroker', broker.testBroker);
router.get('/brokerStatus', broker.fetchBrokerStatus);
router.put('/editBroker/:id', broker.editBroker);
router.get('/getAllBrokers', broker.getAllBrokers);


//mapping
router.post('/addMapping', mapping.addMapping);
router.delete('/deleteMapping/:id', mapping.deleteMapping);

module.exports = router;
