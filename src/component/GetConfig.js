import jsonfile from 'jsonfile';
// get config from file asset/config/config.json
export const getConfig = async () => {
	return new Promise((resolve, reject) => {
		jsonfile.readFile('./asset/config/config.json', async (err, config) => {
			if (err) {
				reject(new Error('Error getting config:', err));
			} else {
				resolve({ config: config });
			}
		});
	});
};
