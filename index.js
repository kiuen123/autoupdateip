// import các thư viện cần thiết
import jsonfile from 'jsonfile';
import axios from 'axios';
import dns from 'dns';
import { WebSocketServer } from 'ws';

// lấy config từ file config.json
var configData = {};
const getConfig = async () => {
	try {
		// Read the configuration file
		jsonfile.readFile('./asset/config/config.json', async (err, config) => {
			if (err) console.error(err);
			else {
				configData = config;
				console.log('HostName:', configData.hostname);
				console.log('Email   :', configData.email);
			}
		});
	} catch (error) {
		console.error('Đọc file config lỗi:', error);
	}
};

// kiểm tra kết nối mạng
const checkConnection = async () => {
	return new Promise((resolve, reject) => {
		dns.resolve('www.google.com', function (err) {
			if (err) {
				reject(new Error('Không có kết nối mạng'));
			} else {
				resolve(true);
			}
		});
	});
};

// lấy IP mới
let currentIP = null;
let newIP = null;
const getNewIPAddress = async () => {
	try {
		const { data } = await axios.get('https://api.ipify.org/?format=json');
		newIP = data.ip;
	} catch (error) {
		console.error('Lỗi không lấy được IP:', error);
	}
};

// Cập nhật IP mới vào DNS
const updateDNSRecord = async () => {
	try {
		// Load authentication headers
		let cfAuthHeaders = {};
		if (configData.UserAPIToken) {
			cfAuthHeaders = { Authorization: `Bearer ${configData.UserAPIToken}` };
		} else if (configData.email && configData.token) {
			cfAuthHeaders = {
				'X-Auth-Email': configData.email,
				'X-Auth-Key': configData.token,
			};
		} else {
			throw new Error('Thiếu thông tin xác thực Cloudflare.');
		}

		// Fetch DNS record ID
		const dnsRecordUrl = `https://api.cloudflare.com/client/v4/zones/${encodeURI(configData.ZoneID)}/dns_records?name=${encodeURI(configData.hostname)}`;
		const { data: dnsData } = await axios.get(dnsRecordUrl, { headers: cfAuthHeaders });
		currentIP = dnsData.result[0].content;
		if (!dnsData.result.length) throw new Error('Không tìm thấy DNS record.');
		await getNewIPAddress();
		// Check if the IP address has changed
		if (currentIP == newIP) {
			console.log(`[${new Date().toLocaleString()}] Không thay đổi IP: ${currentIP}`);
			return;
		}

		// Update each DNS record
		for (const record of dnsData.result) {
			if (!['A', 'AAAA'].includes(record.type)) {
				console.warn(`Bản ghi không hỗ trợ: ${record.type}`);
				continue;
			}

			const updateUrl = `https://api.cloudflare.com/client/v4/zones/${encodeURI(configData.ZoneID)}/dns_records/${encodeURI(record.id)}`;
			const updateData = {
				type: record.type,
				name: record.name,
				content: newIP,
				proxied: true,
			};
			const updateResult = await axios.put(updateUrl, updateData, { headers: cfAuthHeaders });
			if (updateResult.data.success) {
				console.log(`[${new Date().toLocaleString()}] Cập nhật IP: ${currentIP} -> ${newIP}`);
			} else {
				console.error(`Không thể cập nhật DNS record: ${JSON.stringify(updateResult.data.errors, null, 2)}`);
			}
		}

		currentIP = newIP; // Update the current IP after successful update
	} catch (error) {
		console.error('Lỗi khi cập nhật DNS record:', error);
	}
};

// Hàm chính để chạy chương trình
let updateIntervalMinutes = 1; // thời gian cập nhật IP mặc định 1 phút
const updateIntervalMs = 60 * 1000 * updateIntervalMinutes; // chuyển đổi phút sang mili giây
const main = async () => {
	do {
		console.log(`WebSocket Server đang chạy tại ws://localhost:${wsPort}`);
		console.clear();
		await getConfig();
		await checkConnection()
			.then(async () => {
				console.log('Đã kết nối mạng');
				await getNewIPAddress();
				await updateDNSRecord();
			})
			.catch((error) => {
				console.error('Lỗi kết nối mạng:', error);
				console.log(`Thử Lại trong ${updateIntervalMinutes} phút ...`);
			});
		await new Promise((resolve) => setTimeout(resolve, updateIntervalMs));
	} while (true);
};

// Chạy chương trình
main();

// Tạo WebSocket Server để gửi IP mới
const wsPort = 84;
const wss = new WebSocketServer({ port: wsPort });
wss.on('connection', (ws) => {
	const sendThisIP = async () => {
		try {
			const data = {
				currentIP: currentIP,
				newIP: newIP,
			};
			ws.send(JSON.stringify(data));
		} catch (error) {}
	};

	const interval = setInterval(sendThisIP, updateIntervalMs); // gửi IP mỗi phút

	ws.on('close', () => {
		clearInterval(interval);
	});
});
