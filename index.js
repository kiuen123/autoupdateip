import { WebSocketServer } from 'ws';
import { checkConnection } from './src/component/CheckConnection.js';
import { getNewIPAddress } from './src/component/GetNewIPAddress.js';
import { getConfig } from './src/component/GetConfig.js';
import { updateDNSRecord } from './src/component/UpdateDNSRecord.js';

let configData = null; // config data
let newIP = null; // new IP
let updateIntervalMinutes = 5; // thời gian update IP (phút)
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
				.then(async (config) => {
					configData = config.config;
					// check connection
					await checkConnection()
						.then(async () => {
							// get new IP address
							await getNewIPAddress()
								.then(async (ip) => {
									newIP = ip;
									// update DNS record
									await updateDNSRecord(configData, newIP);
								})
								.catch((error) => {
									throw new Error(error);
								});
						})
						.catch((error) => {
							console.log(`Retrying in ${updateIntervalMinutes} minutes ...`);
							throw new Error(error);
						});
				})
				.catch((error) => {
					throw new Error(error);
				});
		} catch (error) {
			console.error(error);
		}
		// wait for the next update
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
