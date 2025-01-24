const express = require('express');
const router = express.Router();

const auth = require('./authentication/authentication');
const broker = require('./controllers/brokerController');
const mapping = require('./controllers/mappingController');
// authentication
router.post('/register', auth.register);
router.post('/login', auth.loginUser); //done
router.get('/user', auth.getUserDetails); //done

//broker
router.post('/addBroker', broker.addBroker); //done
router.delete('/deleteBroker/:id', broker.deleteBroker); //done
router.post('/testBroker', broker.testBroker); //done
router.get('/brokerStatus', broker.fetchBrokerStatus); //done
router.put('/editBroker/:id', broker.editBroker); //done
router.get('/getAllBrokers', broker.getAllBrokers); //done


//mapping
router.post('/addMapping', mapping.addMapping);
router.delete('/deleteMapping/:id', mapping.deleteMapping);
router.put('/editMapping/:id', mapping.editMapping);
router.get('/collectAllMappings', mapping.collectAllMappings);

module.exports = router;
