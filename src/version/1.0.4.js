import jsonfile from 'jsonfile';
import axios from 'axios';
import dns from 'dns';

// Read the configuration file
var configData = {};
jsonfile.readFile('./asset/config/config.json', (err, config) => {
	if (err) console.error(err);
	else {
		configData = config;
	}
});

// Fetch the public IP address
let currentIP = null;
let newIP = null;
const getNewIPAddress = async () => {
	try {
		const { data } = await axios.get('https://api.ipify.org/?format=json');
		newIP = data.ip;
		// return data.ip;
	} catch (error) {
		console.error('Error fetching IP:', error);
		// return null;
	}
};

// Update the DNS record on Cloudflare
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
			throw new Error('Missing authentication credentials (Bearer Token or Email + Key).');
		}

		// Fetch DNS record ID
		const dnsRecordUrl = `https://api.cloudflare.com/client/v4/zones/${encodeURI(configData.ZoneID)}/dns_records?name=${encodeURI(configData.hostname)}`;
		const { data: dnsData } = await axios.get(dnsRecordUrl, { headers: cfAuthHeaders });
		currentIP = dnsData.result[0].content;
		if (!dnsData.result.length) throw new Error('DNS record not found.');
		await getNewIPAddress();
		// Check if the IP address has changed
		if (currentIP == newIP) {
			console.log(`[${new Date().toLocaleString()}] No change in IP address: ${currentIP}`);
			return;
		}

		// Update each DNS record
		for (const record of dnsData.result) {
			if (!['A', 'AAAA'].includes(record.type)) {
				console.warn(`Unsupported DNS record type: ${record.type}`);
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
				console.log(`[${new Date().toLocaleString()}] DNS Record updated: ${currentIP} -> ${newIP}`);
			} else {
				console.error(`Failed to update DNS record: ${JSON.stringify(updateResult.data.errors, null, 2)}`);
			}
		}

		currentIP = newIP; // Update the current IP after successful update
	} catch (error) {
		console.error('Error updating DNS record:', error);
	}
};

let updateIntervalMinutes = 1;
const updateIntervalMs = 60 * 1000 * updateIntervalMinutes || 60000; // Default to 1 minute
// Main function to check the connection and update IP if necessary
const main = async () => {
	try {
		// check connection
		dns.resolve('www.google.com', async (err) => {
			if (err) {
				// If connection error, retry after 1 minute
				console.error('No internet connection');
			} else {
				// If connected to the internet, fetch the new IP and update the DNS record
				console.log('Connected to the internet');
				await updateDNSRecord();
			}
		});
	} catch (error) {
		console.error(`Error in main loop: ${error.message}`);
		console.log(`Retrying in ${updateIntervalMinutes || 1} minute(s)...`);
	}
};

// Initial run
// console.clear();
main();

// Schedule to run periodically
setInterval(main, updateIntervalMs);
