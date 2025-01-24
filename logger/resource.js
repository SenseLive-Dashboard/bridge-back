const pidusage = require('pidusage');
const cron = require('node-cron');
const { Table } = require('console-table-printer'); // Correctly import the Table class

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

        table.addRows([
            { Metric: 'Process ID', Value: `${process.pid}` },
            { Metric: 'CPU Usage', Value: `${stats.cpu.toFixed(2)}%` },
            { Metric: 'Memory Usage', Value: `${(stats.memory / 1024 / 1024).toFixed(2)} MB` },
            { Metric: 'Uptime', Value: uptimeFormatted },
            { Metric: 'Timestamp', Value: new Date().toISOString() },
        ]);

        table.printTable();
    } catch (err) {
        console.error('Error fetching resource usage stats:', err);
    }
}

cron.schedule('* * * * *', async () => {
    await monitorResourceUsage();
});

console.log('Resource monitoring scheduled to run every minute.');
