import dns from 'dns';

// check connection
export const checkConnection = async () => {
	return new Promise((resolve, reject) => {
		dns.resolve('www.google.com', function (err) {
			if (err) {
				reject(new Error('No internet connection'));
			} else {
				console.log(`Connected to the internet`);
				resolve(true);
			}
		});
	});
};
