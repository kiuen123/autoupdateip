import axios from 'axios';
import dns from 'dns';
import config from './config.json' assert { type: 'json' };

let updateIntervalMinutes = 1;
let currentIP = null;
const updateIntervalMs = 60 * 1000 * updateIntervalMinutes || 60000; // Default to 1 minute

// Get the current date-time as a formatted string
const getDateTime = () => {
	const now = new Date();
	return now.toLocaleString();
};

// Fetch the public IP address
const getNewIPAddress = async () => {
	try {
		const { data } = await axios.get('https://api.ipify.org/?format=json');
		return data.ip;
	} catch (error) {
		console.error('Error fetching IP:', error);
		return null;
	}
};

// Update the DNS record on Cloudflare
const updateDNSRecord = async (newIP) => {
	try {
		// Load authentication headers
		let cfAuthHeaders = {};
		if (config.UserAPIToken) {
			cfAuthHeaders = { Authorization: `Bearer ${config.UserAPIToken}` };
		} else if (config.email && config.token) {
			cfAuthHeaders = {
				'X-Auth-Email': config.email,
				'X-Auth-Key': config.token,
			};
		} else {
			throw new Error('Missing authentication credentials (Bearer Token or Email + Key).');
		}

		// Fetch DNS record ID
		const dnsRecordUrl = `https://api.cloudflare.com/client/v4/zones/${encodeURI(config.ZoneID)}/dns_records?name=${encodeURI(config.hostname)}`;
		const { data: dnsData } = await axios.get(dnsRecordUrl, { headers: cfAuthHeaders });
		currentIP = dnsData.result[0].content;
		if (!dnsData.result.length) throw new Error('DNS record not found.');

		// Update each DNS record
		for (const record of dnsData.result) {
			if (!['A', 'AAAA'].includes(record.type)) {
				console.warn(`Unsupported DNS record type: ${record.type}`);
				continue;
			}

			const updateUrl = `https://api.cloudflare.com/client/v4/zones/${encodeURI(config.ZoneID)}/dns_records/${encodeURI(record.id)}`;
			const updateData = {
				type: record.type,
				name: record.name,
				content: newIP,
				proxied: true,
			};

			const updateResult = await axios.put(updateUrl, updateData, { headers: cfAuthHeaders });
			if (updateResult.data.success) {
				console.log(`[${getDateTime()}] DNS Record updated: ${currentIP} -> ${newIP}`);
			} else {
				console.error(`Failed to update DNS record: ${JSON.stringify(updateResult.data.errors, null, 2)}`);
			}
		}

		currentIP = newIP; // Update the current IP after successful update
	} catch (error) {
		console.error('Error updating DNS record:', error);
	}
};

// Main function to check the connection and update IP if necessary
const main = async () => {
	try {
		await dns.promises.resolve('www.google.com'); // Check internet connection
		const newIP = await getNewIPAddress();
		if (newIP && newIP !== currentIP) {
			await updateDNSRecord(newIP);
		}
	} catch (error) {
		console.error(`Error in main loop: ${error.message}`);
		console.log(`Retrying in ${updateIntervalMinutes || 1} minute(s)...`);
	}
};

// Initial run
console.clear();
main();

// Schedule to run periodically
setInterval(main, updateIntervalMs);
