import jsonrpc from 'JSONRpc'
import fs from 'fs';
import nkn from 'nkn-sdk';
import publicIp from 'public-ip'
import WebSocket from 'ws';

// NKNIP The IP of the NKN node.
// This is intended for LOCAL nodes, but nothing blocks you from using it on any IP that has NKN running.
const jsonrpcClient = new jsonrpc(process.env.NKNIP, process.env.NKNPORT);

const pingInterval = 5000;

const baseDir = './nkn/';
const walletFile = baseDir + 'wallet.json';
const passwordFile = baseDir + 'wallet.pswd';

if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir);
    console.log("Create directory", baseDir);
}

let wallet;
try {
    let walletJson = fs.readFileSync(walletFile).toString();
    let password;
    try {
        password = fs.readFileSync(passwordFile).toString();
    } catch (e) {
        console.error("Open password file error:", e.message);
        process.exit(1);
    }
    try {
        wallet = nkn.Wallet.fromJSON(walletJson, { password });
    } catch (e) {
        console.error("Parse wallet error:", e);
        process.exit(1);
    }
} catch (e) {
    let password
    try {
        password = fs.readFileSync(passwordFile).toString();
    } catch (e) {
        password = Buffer.from(Math.random().toString(32)).toString('base64');
        fs.writeFileSync(passwordFile, password);
        console.log("Create password and save to file", passwordFile);
    }
    wallet = new nkn.Wallet({ password });
    fs.writeFileSync(walletFile, JSON.stringify(wallet));
    console.log("Create wallet and save to file", walletFile);
}

(async () => {
    let client = new nkn.Client({
        seed: wallet.getSeed()
    });

    // Get this node's public IP
    const ip = await publicIp.v4();

    client.shouldReconnect = true;
    let returnObj = {
        host: ip,
        uptime: 0,
        height: 0,
        relayMessageCount: 0,
        time: Math.floor(Date.now() / 1000),
        state: 0
    };

    setInterval(async function () {
        try {
            client.ws.ping && client.ws.ping();
            let nodeState = await jsonrpcClient.callPromise('getnodestate', {})

            if (nodeState.syncState == 'PERSIST_FINISHED') {
                returnObj.state = 1; // PERSIST_FINISHED or: ALL OK.
            }

            returnObj.uptime = nodeState.uptime;
            returnObj.relayMessageCount = nodeState.relayMessageCount;
            returnObj.height = nodeState.height;
            returnObj.time = nodeState.currTimeStamp;
            
            // You should define the TARGETPUBKEY environment variable!
            await client.send(process.env.TARGETPUBKEY, JSON.stringify(returnObj), { msgHoldingSeconds: 0 });
        } catch (e) {
            if ('code' in e) {
                if (e.code == -45024) {
                    returnObj.state = 2; // PRUNING
                } else if (e.code == -45022) {
                    returnObj.state = 3; // GENERATING ID
                }
                
                try {
                    await client.send(process.env.TARGETPUBKEY, JSON.stringify(returnObj), { msgHoldingSeconds: 0 });
                } catch (error) {
                    console.log('Inner error:', error)
                }
            } else {
                console.warn('error:', e);
            }

        }
    }, pingInterval);

    await new Promise((resolve, reject) => {
        client.onConnect(resolve);
        setTimeout(reject, pingInterval);
    });

    console.log(client.getPublicKey());
})()