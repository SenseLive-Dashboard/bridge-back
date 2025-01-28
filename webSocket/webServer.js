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

const server = new WebSocket.Server({ port: 8001 });

server.on('connection', (socket) => {
  console.log('New client connected.');

  setupRateLimiting(socket);

  socket.on('message', (message) => {

    try {
      if (message.length > 5 * 1024 * 1024) {
        //console.log('Message size exceeded 5MB.');
        socket.send(JSON.stringify({ type: 'error', message: 'Message size limit exceeded.' }));
        return;
      }

      const data = JSON.parse(message);

      if (data.type === 'auth') {
        handleAuthentication(socket, data);
      } else if (!clients.has(socket)) {
        //console.log('Client attempted to send data without authentication.');
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
    //console.log('Client disconnected.');
    handleDisconnection(socket);
  });

  socket.on('error', (error) => {
    console.error('WebSocket error:', error);
    socket.close();
  });
});

console.log('WebSocket server is running on ws://localhost:8001');

function handleAuthentication(socket, data) {
  const { username, password } = data;
  console.log(`Authentication attempt by username: ${username}`);

  if (!username || !password) {
   // console.log('Missing credentials during authentication.');
    socket.send(JSON.stringify({ type: 'auth', status: 'failure', message: 'Missing credentials.' }));
    socket.close();
    return;
  }

  const hashedPassword = hashPassword(password);

  if (users[username] && users[username] === hashedPassword) {
    //console.log(`User ${username} authenticated successfully.`);
    clients.set(socket, { username, subscriptions: new Set() });
    socket.send(JSON.stringify({ type: 'auth', status: 'success' }));
  } else {
    //console.log(`Authentication failed for username: ${username}`);
    socket.send(JSON.stringify({ type: 'auth', status: 'failure', message: 'Invalid credentials' }));
    socket.close();
  }
}

function handleClientMessage(socket, data) {
  const clientData = clients.get(socket);
  //console.log(`Handling message from user: ${clientData.username}, data: ${JSON.stringify(data)}`);

  switch (data.type) {
    case 'subscribe':
      if (!data.topic || typeof data.topic !== 'string') {
       // console.log('Invalid topic format during subscription.');
        socket.send(JSON.stringify({ type: 'error', message: 'Invalid topic.' }));
        return;
      }

      const topic = data.topic;
      //console.log(`User ${clientData.username} is subscribing to topic: ${topic}`);

      if (!topics.has(topic)) {
        topics.set(topic, new Set());
      }

      topics.get(topic).add(socket);
      clientData.subscriptions.add(topic);
      socket.send(JSON.stringify({ type: 'subscribe', status: 'success', topic }));
      break;

    case 'publish':
      if (!data.topic || !data.message || typeof data.topic !== 'string' || typeof data.message !== 'string') {
        //console.log('Invalid publish format.');
        socket.send(JSON.stringify({ type: 'error', message: 'Invalid publish format.' }));
        return;
      }

      const pubTopic = data.topic;
      const message = data.message;

      //console.log(`User ${clientData.username} is publishing to topic: ${pubTopic}, message: ${message}`);

      if (!topics.has(pubTopic)) {
       // console.log(`Topic ${pubTopic} does not exist.`);
        socket.send(JSON.stringify({ type: 'error', message: `Topic ${pubTopic} does not exist.` }));
        return;
      }

      for (const client of topics.get(pubTopic)) {
        if (client.readyState === WebSocket.OPEN) {
         // console.log(`Delivering message to a subscriber on topic: ${pubTopic}`);
          client.send(JSON.stringify({ type: 'message', topic: pubTopic, message }));
        }
      }
      break;

    default:
     // console.log('Unknown message type received.');
      socket.send(JSON.stringify({ type: 'error', message: 'Unknown message type.' }));
  }
}

function handleDisconnection(socket) {
  const clientData = clients.get(socket);

  if (clientData) {
    //console.log(`User ${clientData.username} is disconnecting.`);

    for (const topic of clientData.subscriptions) {
      ///console.log(`Removing user ${clientData.username} from topic: ${topic}`);
      topics.get(topic)?.delete(socket);

      if (topics.get(topic)?.size === 0) {
        //console.log(`Deleting empty topic: ${topic}`);
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
      //console.log('Rate limit exceeded for a client.');
      socket.send(JSON.stringify({ type: 'error', message: 'Rate limit exceeded.' }));
      socket.close();
    }
  });

  socket.on('close', () => {
    clearInterval(interval);
  });
}
