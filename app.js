const express = require('express');
const cors = require('cors');
const router = require('./routes');
const bodyParser = require('body-parser');
const { errorHandler } = require('./middleware/errorMiddleware');
const mqttBrokerHandler = require('./handlers/mqttBrokerHandler');
const mqttMappingHandler = require('./handlers/mqttMappingHandler');
const pidusage = require('pidusage');

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

async function monitorResourceUsage() {
  try {
      const stats = await pidusage(process.pid); // Fetch stats asynchronously
      console.log(process.pid);
      console.log(`CPU Usage: ${stats.cpu.toFixed(2)}%`);
      console.log(`Memory Usage: ${(stats.memory / 1024 / 1024).toFixed(2)} MB`);
  } catch (err) {
      console.error('Error fetching resource usage stats:', err);
  }
}

monitorResourceUsage();

setInterval(() => {
  monitorResourceUsage();
}, 10 * 1000);

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
