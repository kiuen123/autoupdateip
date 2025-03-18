import axios from 'axios';
// Update DNS record
export const updateDNSRecord = async (configData, newIP) => {
	try {
		let cfAuthHeaders = {};
		if (configData.UserAPIToken) {
			cfAuthHeaders = { Authorization: `Bearer ${configData.UserAPIToken}` };
		} else if (configData.email && configData.token) {
			cfAuthHeaders = {
				'X-Auth-Email': configData.email,
				'X-Auth-Key': configData.token,
			};
		} else {
			throw new Error('Lost authentication headers.');
		}

		for (const item of configData.hostname) {
			// get the DNS record
			const dnsRecordUrl = `https://api.cloudflare.com/client/v4/zones/${encodeURI(configData.ZoneID)}/dns_records?name=${encodeURI(item)}`;
			const { data: dnsData } = await axios.get(dnsRecordUrl, { headers: cfAuthHeaders });

			if (!dnsData.result.length) {
				console.error(`DNS record not found for ${item}`);
				continue;
			}

			if (dnsData.result[0].content == newIP) {
				console.log(`[${new Date().toLocaleString()}] ${item}: ${dnsData.result[0].content}`);
				continue;
			}

			// update the DNS record
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
					console.log(`[${new Date().toLocaleString()}] ${item}: ${newIP}`);
				} else {
					console.error(`Failed to update ${record.name}:`, JSON.stringify(updateResult.data.errors, null, 2));
				}
			}
		}
	} catch (error) {
		throw new Error(`Error updating DNS record: ${error}`);
	}
};
