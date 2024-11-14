import axios from 'axios';
import dns from 'dns';
import config from '../../config.json' assert { type: 'json' };

let IP = null;
let NewIP = null;
let sec = 1000;
let SecOfMin = 60;
let TimeToUpdate = 1; //time to update IP (min)

//get date-time
const getDateTime = () => {
	let today = new Date();
	let date = today.getDate() + '-' + (today.getMonth() + 1) + '-' + today.getFullYear();
	let time = today.getHours() + ':' + today.getMinutes() + ':' + today.getSeconds();
	let DateTime = date + ' ' + time;
	return DateTime;
};

async function getNewIPAddress() {
	try {
		const response = await fetch('https://api.ipify.org/?format=json');
		const data = await response.json();
		return data.ip;
	} catch (error) {
		console.error('Error fetching IP:', error);
		return null;
	}
}

async function changeIP() {
	try {
		// Load Config
		if (!config.hostname) {
			throw Error('Hostname missing');
		}
		let cfAuthHeaders = {};
		if (config.UserAPIToken) {
			cfAuthHeaders = {
				Authorization: `Bearer ${config.UserAPIToken}`,
			};
		} else if (config.email && config.token) {
			cfAuthHeaders = {
				'X-Auth-Email': config.email,
				'X-Auth-Key': config.token,
			};
		} else {
			throw Error('Bearer Token or (Email + Key) missing');
		}

		// Get DNS Record ID
		const cfDnsIdReqUrl = `https://api.cloudflare.com/client/v4/zones/${encodeURI(config.ZoneID)}/dns_records?name=${encodeURI(config.hostname)}`;
		const cfDnsIdRes = await axios.get(cfDnsIdReqUrl, {
			headers: cfAuthHeaders,
		});
		if (cfDnsIdRes.data.result.length <= 0) {
			throw Error('DNS record not found');
		}

		const results = await Promise.all(
			cfDnsIdRes.data.result.map(async (cfDnsRecord) => {
				IP = cfDnsRecord.content;
				let content;
				switch (cfDnsRecord.type) {
					case 'A':
						content = NewIP;
						break;
					case 'AAAA':
						content = NewIP;
						break;
					default:
						console.error(`DNS Record Type unsupported: ${cfDnsRecord.type}`);
						return;
				}
				// Update DNS Record
				const cfPutReqUrl = `https://api.cloudflare.com/client/v4/zones/${encodeURI(config.ZoneID)}/dns_records/${encodeURI(cfDnsRecord.id)}`;
				const cfPutReqData = {
					type: cfDnsRecord.type,
					name: cfDnsRecord.name,
					content: content,
					proxied: true,
				};
				return axios.put(cfPutReqUrl, cfPutReqData, { headers: cfAuthHeaders });
			}),
		);
		results.forEach((result) => {
			if (!result || !result.data) {
				console.error('Warning: null result received, see above for error messages');
				return;
			}
			if (result.data.success === true) {
				console.log('DNS Record update success at: ' + getDateTime());
				console.log('IP has been updated: ' + IP + ' ==> ' + NewIP);
			} else {
				console.error('\nDNS Record update failed:\n', JSON.stringify(result.data.errors, undefined, 2));
			}
		});
	} catch (err) {
		console.log(err);
	}
}

const main = () => {
	//check connection
	dns.resolve('www.google.com', function (err) {
		if (err) {
			console.log('No connection please check your internet connection and this auto try again after ' + TimeToUpdate + ' minute');
		} else {
			(async () => {
				try {
					NewIP = await getNewIPAddress();
					//check get new ip success
					if (NewIP) {
						//check if ip changed
						if (IP !== NewIP) {
							//update ip
							changeIP();
						}
					}
				} catch (err) {
					console.log(err);
				}
			})();
		}
	});
};

console.clear();

//run first time
main();

//update ip every time
setInterval(async () => {
	main();
}, TimeToUpdate * SecOfMin * sec);
