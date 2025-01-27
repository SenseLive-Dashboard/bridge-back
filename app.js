const express = require('express');
const cors = require('cors');
const router = require('./routes');
const bodyParser = require('body-parser');
const { errorHandler } = require('./middleware/errorMiddleware');
const mqttBrokerHandler = require('./handlers/mqttBrokerHandler');
const mqttMappingHandler = require('./handlers/mqttMappingHandler');
require('./logger/resource');
require('./webSocket/webServer');

const app = express();
const port = 8000;

app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

// Use the router for handling routes
app.use('/bridge', router);
app.use(errorHandler);

// Start monitoring brokers and mappings
mqttBrokerHandler.monitorBrokers();
mqttMappingHandler.monitorMappings();


// // Start the server
// app.listen(port, () => {
//   console.log(`Server running on port ${port}`);
// });

app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${port}`);
});
