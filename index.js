import publicIp from "public-ip";
import axios from "axios";
import config from "./config.json" assert { type: "json" };

//lấy ngày giờ
const getDateTime = () => {
    let today = new Date();
    let date = today.getDate() + "-" + (today.getMonth() + 1) + "-" + today.getFullYear();
    let time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    let DateTime = date + " " + time;
    return DateTime;
};
//khởi tạo IP
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
                console.log("DNS Record ID: ", cfDnsRecord.id);
                IP = cfDnsRecord.content;
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
                console.error(`Warning: null result received, see above for error messages`);
                return;
            }
            if (result.data.success === true) {
                console.log(
                    `DNS Record update success at `,
                    getDateTime(),
                    `: `,
                    JSON.stringify(result.data, undefined, 2)
                );
            } else {
                console.error(`DNS Record update failed: `, JSON.stringify(result.data.errors, undefined, 2));
            }
        });
    } catch (err) {
        console.log(err);
    }
}

//cập nhật ip mỗi 1'
setInterval(async () => {
    NewIP = await publicIp.v4();
    //kiểm tra xem IP có thay đổi ko
    if (IP !== NewIP) {
        //nếu có thì xử lí IP trong này
        main();
        // console.log(IP + " " + getDateTime());
    } else {
        //nếu ko thì ko làm j cả hoặc làm gì đó ở dưới
    }
}, 60 * 1000);
