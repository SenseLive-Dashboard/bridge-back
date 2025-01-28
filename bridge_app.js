const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const https = require('https');

const router = require('./routes');
const { errorHandler } = require('./middleware/errorMiddleware');
const mqttBrokerHandler = require('./handlers/mqttBrokerHandler');
const mqttMappingHandler = require('./handlers/mqttMappingHandler');

require('./logger/resource');
require('./webSocket/wss');

const privateKey = fs.readFileSync(process.env.SSL_KEY_PATH, 'utf8');
const fullchain = fs.readFileSync(process.env.SSL_CERT_PATH, 'utf8');
const credentials = { key: privateKey, cert: fullchain };

const allowedOrigins = ['https://bridge.senselive.io', 'bridge.senselive.io'];
const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 200,
};

const app = express();
const port = process.env.PORT || 8000;

app.use(cors(corsOptions));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
    const origin = req.headers.origin || req.headers.host;
    if (!origin || allowedOrigins.includes(origin)) {
        next();
    } else {
        return res.status(403).sendFile(path.join(__dirname, 'public', 'access_denied.html'));
    }
});

app.use('/bridge', router);
app.use(errorHandler);

mqttBrokerHandler.monitorBrokers();
mqttMappingHandler.monitorMappings();

const httpsServer = https.createServer(credentials, app);
httpsServer.listen(port, () => {
    console.log(`HTTPS server listening on port ${port}`);
});
