// const pidusage = require('pidusage');
// const cron = require('node-cron');
// const { Table } = require('console-table-printer'); // Correctly import the Table class

// async function formatUptime(milliseconds) {
//     const seconds = Math.floor(milliseconds / 1000);
//     const days = Math.floor(seconds / (24 * 3600));
//     const hours = Math.floor((seconds % (24 * 3600)) / 3600);
//     const minutes = Math.floor((seconds % 3600) / 60);
//     const secs = seconds % 60;

//     const uptimeParts = [];
//     if (days > 0) uptimeParts.push(`${days} D`);
//     if (hours > 0) uptimeParts.push(`${hours} HR`);
//     if (minutes > 0) uptimeParts.push(`${minutes} Min`);
//     if (secs > 0) uptimeParts.push(`${secs} Sec`);

//     return uptimeParts.join(' ');
// }

// async function monitorResourceUsage() {
//     try {
//         const stats = await pidusage(process.pid);
//         const uptimeFormatted = await formatUptime(stats.elapsed);

//         const table = new Table({
//             title: 'Resource Usage',
//             columns: [
//                 { name: 'Metric', alignment: 'left' },
//                 { name: 'Value', alignment: 'right' },
//             ],
//         });

//         table.addRows([
//             { Metric: 'Process ID', Value: `${process.pid}` },
//             { Metric: 'CPU Usage', Value: `${stats.cpu.toFixed(2)}%` },
//             { Metric: 'Memory Usage', Value: `${(stats.memory / 1024 / 1024).toFixed(2)} MB` },
//             { Metric: 'Uptime', Value: uptimeFormatted },
//             { Metric: 'Timestamp', Value: new Date().toISOString() },
//         ]);

//         table.printTable();
//     } catch (err) {
//         console.error('Error fetching resource usage stats:', err);
//     }
// }

// cron.schedule('* * * * *', async () => {
//     await monitorResourceUsage();
// });

// console.log('Resource monitoring scheduled to run every minute.');


/*----------------------------New code--------------------------------------------*/
const pidusage = require('pidusage');
const cron = require('node-cron');
const { Table } = require('console-table-printer');
const WebSocket = require('ws');

const username = 'SenseLive';
const password = 'SenseLive@Password';
const topic = 'bridge/resource';
const serverUrl = 'ws://localhost:8001';

let ws;

function connectWebSocket() {
    ws = new WebSocket(serverUrl);

    ws.on('open', () => {
        // console.log('Connected to WebSocket server.');

        ws.send(JSON.stringify({ type: 'auth', username, password }));

        ws.on('message', (message) => {
            const response = JSON.parse(message);

            if (response.type === 'auth' && response.status === 'success') {
                ws.send(JSON.stringify({ type: 'subscribe', topic }));
            }
        });
    });

    ws.on('close', () => {
        //console.log('WebSocket connection closed. Reconnecting...');
        setTimeout(connectWebSocket, 5000);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
}

async function sendResourceData(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'publish', topic, message: JSON.stringify(data) }));
    } else {
        //console.log('WebSocket not connected. Unable to send resource data.');
    }
}

async function formatUptime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const days = Math.floor(seconds / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const uptimeParts = [];
    if (days > 0) uptimeParts.push(`${days} D`);
    if (hours > 0) uptimeParts.push(`${hours} HR`);
    if (minutes > 0) uptimeParts.push(`${minutes} Min`);
    if (secs > 0) uptimeParts.push(`${secs} Sec`);

    return uptimeParts.join(' ');
}

async function monitorResourceUsage() {
    try {
        const stats = await pidusage(process.pid);
        const uptimeFormatted = await formatUptime(stats.elapsed);

        const table = new Table({
            title: 'Resource Usage',
            columns: [
                { name: 'Metric', alignment: 'left' },
                { name: 'Value', alignment: 'right' },
            ],
        });

        const resourceData = {
            pid: process.pid,
            cpu: stats.cpu.toFixed(2),
            memory: (stats.memory / 1024 / 1024).toFixed(2),
            uptime: uptimeFormatted,
            timestamp: new Date().toISOString(),
        };

        table.addRows([
            { Metric: 'Process ID', Value: resourceData.pid },
            { Metric: 'CPU Usage', Value: `${resourceData.cpu}%` },
            { Metric: 'Memory Usage', Value: `${resourceData.memory} MB` },
            { Metric: 'Uptime', Value: resourceData.uptime },
            { Metric: 'Timestamp', Value: resourceData.timestamp },
        ]);

        table.printTable();
        await sendResourceData(resourceData);
    } catch (err) {
        console.error('Error fetching resource usage stats:', err);
    }
}

// Schedule monitoring to run every minute
cron.schedule('* * * * *', async () => {
    await monitorResourceUsage();
});
connectWebSocket();
