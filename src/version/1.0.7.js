import { WebSocketServer } from 'ws';
import { checkConnection } from '../../src/component/CheckConnection.js';
import { getNewIPAddress } from '../../src/component/GetNewIPAddress.js';
import { getConfig } from '../../src/component/GetConfig.js';
import { updateDNSRecord } from '../../src/component/UpdateDNSRecord.js';

let configData = null; // config data
let newIP = null; // new IP
let updateIntervalMinutes = 1; // thời gian update IP (phút)
const updateIntervalMs = 60 * 1000 * updateIntervalMinutes; // đổi phút sang mili giây
const wsPort = 1500; // cổng WebSocket Server
const wss = new WebSocketServer({ port: wsPort }); // tạo WebSocket Server

const main = async () => {
	do {
		try {
			console.clear();
			console.log(`WebSocket Server is running on ws://localhost:${wsPort}`);
			// get configuration
			await getConfig()
				.then((config) => {
					configData = config.config;
				})
				.catch((error) => {
					throw new Error(error);
				});

			// get new IP address
			await getNewIPAddress()
				.then((ip) => {
					newIP = ip;
				})
				.catch((error) => {
					throw new Error(error);
				});

			// check connection
			await checkConnection()
				.then(async () => {
					await updateDNSRecord(configData, newIP);
				})
				.catch((error) => {
					console.log(`Retrying in ${updateIntervalMinutes} minutes ...`);
					throw new Error(error);
				});

			// wait for the next update
		} catch (error) {
			console.error(error);
		}
		await new Promise((resolve) => setTimeout(resolve, updateIntervalMs));
	} while (true);
};

main();

// Create WebSocket Server and send ip address to client
wss.on('connection', (ws) => {
	const sendThisIP = async () => {
		try {
			const data = {
				IP: newIP,
			};
			ws.send(JSON.stringify(data));
		} catch (error) {}
	};

	const interval = setInterval(sendThisIP, updateIntervalMs); // gửi IP mỗi phút

	ws.on('close', () => {
		clearInterval(interval);
	});
});
