import publicIp from "public-ip";
import axios from "axios";
import config from "./config.json" assert { type: "json" };

//get date-time
const getDateTime = () => {
    let today = new Date();
    let date = today.getDate() + "-" + (today.getMonth() + 1) + "-" + today.getFullYear();
    let time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    let DateTime = date + " " + time;
    return DateTime;
};

let IP = null;
let NewIP = null;

async function main() {
    try {
        // Load Config
        if (!config.hostname) {
            throw Error("Hostname missing");
        }
        let cfAuthHeaders = {};
        if (config.bearerToken) {
            cfAuthHeaders = {
                Authorization: `Bearer ${config.bearerToken}`,
            };
        } else if (config.email && config.token) {
            cfAuthHeaders = {
                "X-Auth-Email": config.email,
                "X-Auth-Key": config.token,
            };
        } else {
            throw Error("Bearer Token or (Email + Key) missing");
        }

        // Get DNS Record ID
        const cfDnsIdReqUrl = `https://api.cloudflare.com/client/v4/zones/${encodeURI(
            config.zoneid
        )}/dns_records?name=${encodeURI(config.hostname)}`;
        const cfDnsIdRes = await axios.get(cfDnsIdReqUrl, {
            headers: cfAuthHeaders,
        });
        if (cfDnsIdRes.data.result.length <= 0) {
            throw Error("DNS record not found");
        }

        const results = await Promise.all(
            cfDnsIdRes.data.result.map(async (cfDnsRecord) => {
                IP = cfDnsRecord.content;
                console.log(`Current IP : ${IP}`);
                console.log(`New IP     : ${NewIP}`);
                let content;
                switch (cfDnsRecord.type) {
                    case "A":
                        content = NewIP;
                        break;
                    case "AAAA":
                        content = NewIP;
                        break;
                    default:
                        console.error(`DNS Record Type unsupported: ${cfDnsRecord.type}`);
                        return;
                }
                // Update DNS Record
                const cfPutReqUrl = `https://api.cloudflare.com/client/v4/zones/${encodeURI(
                    config.zoneid
                )}/dns_records/${encodeURI(cfDnsRecord.id)}`;
                const cfPutReqData = {
                    type: cfDnsRecord.type,
                    name: cfDnsRecord.name,
                    content: content,
                    proxied: true,
                };
                return axios.put(cfPutReqUrl, cfPutReqData, { headers: cfAuthHeaders });
            })
        );
        results.forEach((result) => {
            if (!result || !result.data) {
                console.error("Warning: null result received, see above for error messages");
                return;
            }
            if (result.data.success === true) {
                console.log(`DNS Record update success at :`, getDateTime());
            } else {
                console.error("DNS Record update failed :\n", JSON.stringify(result.data.errors, undefined, 2));
            }
        });
    } catch (err) {
        console.log(err);
    }
}

//run first time
(async () => {
    NewIP = await publicIp.v4();
})();
main();

//update ip every 1'
setInterval(async () => {
    NewIP = await publicIp.v4();
    //check if ip changed
    if (IP !== NewIP) {
        //update ip
        main();
    } else {
        //do nothing
    }
}, 60 * 1000);
