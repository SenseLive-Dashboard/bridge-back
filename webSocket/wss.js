const fs = require('fs');
const https = require('https');
const WebSocket = require('ws');
const crypto = require('crypto');

const users = {
  SenseLive: hashPassword('SenseLive@Password'),
  SenseLive2: hashPassword('SenseLive@2025'),
};

const clients = new Map();
const topics = new Map();

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

const server = https.createServer({
  key: fs.readFileSync('/etc/letsencrypt/live/senso.senselive.io/privkey.pem', 'utf8'),
  cert: fs.readFileSync('/etc/letsencrypt/live/senso.senselive.io/fullchain.pem', 'utf8'),
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (socket) => {
  console.log('New client connected.');

  setupRateLimiting(socket);

  socket.on('message', (message) => {
    try {
      if (message.length > 5 * 1024 * 1024) {
        socket.send(JSON.stringify({ type: 'error', message: 'Message size limit exceeded.' }));
        return;
      }

      const data = JSON.parse(message);

      if (data.type === 'auth') {
        handleAuthentication(socket, data);
      } else if (!clients.has(socket)) {
        socket.send(JSON.stringify({ type: 'error', message: 'Authenticate first.' }));
        socket.close();
      } else {
        handleClientMessage(socket, data);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      socket.send(JSON.stringify({ type: 'error', message: 'Invalid message format.' }));
    }
  });

  socket.on('close', () => {
    handleDisconnection(socket);
  });

  socket.on('error', (error) => {
    console.error('WebSocket error:', error);
    socket.close();
  });
});

server.listen(8001, '0.0.0.0', () => {
  console.log('Secure WebSocket server is running on wss://0.0.0.0:8001');
});

function handleAuthentication(socket, data) {
  const { username, password } = data;

  if (!username || !password) {
    socket.send(JSON.stringify({ type: 'auth', status: 'failure', message: 'Missing credentials.' }));
    socket.close();
    return;
  }

  const hashedPassword = hashPassword(password);

  if (users[username] && users[username] === hashedPassword) {
    clients.set(socket, { username, subscriptions: new Set() });
    socket.send(JSON.stringify({ type: 'auth', status: 'success' }));
  } else {
    socket.send(JSON.stringify({ type: 'auth', status: 'failure', message: 'Invalid credentials' }));
    socket.close();
  }
}

function handleClientMessage(socket, data) {
  const clientData = clients.get(socket);

  switch (data.type) {
    case 'subscribe':
      if (!data.topic || typeof data.topic !== 'string') {
        socket.send(JSON.stringify({ type: 'error', message: 'Invalid topic.' }));
        return;
      }

      const topic = data.topic;

      if (!topics.has(topic)) {
        topics.set(topic, new Set());
      }

      topics.get(topic).add(socket);
      clientData.subscriptions.add(topic);
      socket.send(JSON.stringify({ type: 'subscribe', status: 'success', topic }));
      break;

    case 'publish':
      if (!data.topic || !data.message || typeof data.topic !== 'string' || typeof data.message !== 'string') {
        socket.send(JSON.stringify({ type: 'error', message: 'Invalid publish format.' }));
        return;
      }

      const pubTopic = data.topic;
      const message = data.message;

      if (!topics.has(pubTopic)) {
        socket.send(JSON.stringify({ type: 'error', message: `Topic ${pubTopic} does not exist.` }));
        return;
      }

      for (const client of topics.get(pubTopic)) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'message', topic: pubTopic, message }));
        }
      }
      break;

    default:
      socket.send(JSON.stringify({ type: 'error', message: 'Unknown message type.' }));
  }
}

function handleDisconnection(socket) {
  const clientData = clients.get(socket);

  if (clientData) {
    for (const topic of clientData.subscriptions) {
      topics.get(topic)?.delete(socket);

      if (topics.get(topic)?.size === 0) {
        topics.delete(topic);
      }
    }

    clients.delete(socket);
  }
}

function setupRateLimiting(socket) {
  let messageCount = 0;
  const maxMessages = 10;
  const interval = setInterval(() => {
    messageCount = 0;
  }, 1000);

  socket.on('message', () => {
    messageCount++;
    if (messageCount > maxMessages) {
      socket.send(JSON.stringify({ type: 'error', message: 'Rate limit exceeded.' }));
      socket.close();
    }
  });

  socket.on('close', () => {
    clearInterval(interval);
  });
}
