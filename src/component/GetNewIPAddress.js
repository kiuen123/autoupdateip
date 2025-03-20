import axios from 'axios';
// get new IP address from https://api.ipify.org/?format=json
export const getNewIPAddress = async () => {
	return new Promise((resolve, reject) => {
		axios
			.get('https://api.ipify.org/?format=json')
			.then(({ data }) => {
				console.log(`IP address: ${data.ip}`);
				resolve(data.ip);
			})
			.catch((error) => {
				reject(new Error(`Error getting new IP address: ${error}`));
			});
	});
};
