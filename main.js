const mineflayer = require("mineflayer");
const readline = require("readline");
const autoeat = require('mineflayer-auto-eat').plugin
const fs = require("fs");
const Vec3 = require('vec3')
const inventoryViewer = require('mineflayer-web-inventory');
const registry = require('prismarine-registry')('1.20.1')
const path = require('path');
const configFilePath = path.resolve(__dirname, 'config.json');

let config = JSON.parse(fs.readFileSync(configFilePath), 'utf8');

let bot;

let rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const botArgs = {
    host: config.bot_args.host,
    port: config.bot_args.port,
    username: config.bot_args.username,
    version: config.bot_args.version,
    auth: config.bot_args.auth,
    keepAlive: true,
    checkTimeoutInterval: 60 * 1000
};

const initBot = () => {
    bot = mineflayer.createBot(botArgs);
    bot.loadPlugin(autoeat)
    let options = {
        port: 40241
    }
    
    inventoryViewer(bot, options)
    
    bot.once("login", () => {
        let botSocket = bot._client.socket;
        console.log('[INFO] ' + `已成功登入 ${botSocket.server ? botSocket.server : botSocket._host}`);
    });

    bot.once("spawn", async () => {
        bot.chat('bot is online')
        console.log('[INFO] ' + `地圖已載入`);

        rl.on("line", function (line) {
            bot.chat(line)
        });

        let config = JSON.parse(fs.readFileSync(configFilePath), 'utf8');

        await bot.chat(config.main_warp)

        for (const position of config.locations) {
            console.log(`Placing block at ${position}`)
            let block = bot.blockAt(new Vec3(position[0], position[1], position[2]))

            try {
                await bot.equip(registry.itemsByName[config.block].id, 'hand')

                if (block) {
                    await bot._genericPlace(bot.blockAt(new Vec3(position[0], position[1], position[2])), new Vec3(0, -1, 0), { forceLook: 'ignore' })
                }
            } catch (error) {}
        }
    });

    bot.on('blockUpdate', async (oldBlock, newBlock) => {
        let config = JSON.parse(fs.readFileSync(configFilePath), 'utf8');

        for (const position of config.place_locations) {
            let block = bot.blockAt(new Vec3(newBlock.position.x, newBlock.position.y, newBlock.position.z))

            if (!block) continue

            if (newBlock.position.x === position[0] && newBlock.position.y === position[1] && newBlock.position.z === position[2] && oldBlock.position.x === position[0] && oldBlock.position.y === position[1] && oldBlock.position.z === position[2] && bot.blockAt(new Vec3(newBlock.position.x, newBlock.position.y, newBlock.position.z)).type == 0) {
                console.log(`Block update: ${oldBlock.name} at ${oldBlock.position} has been updated to ${newBlock.name} at ${newBlock.position}`)
                try {
                    await bot.equip(registry.itemsByName[config.block].id, 'hand')
                    await bot._genericPlace(block, new Vec3(0, -1, 0), { forceLook: 'ignore' })
                } catch (error) {}
            }
        }

        for (const position of config.mine_locations) {
            if (newBlock.position.x === position[0] && newBlock.position.y === position[1] && newBlock.position.z === position[2] && oldBlock.position.x === position[0] && oldBlock.position.y === position[1] && oldBlock.position.z === position[2] && bot.blockAt(new Vec3(newBlock.position.x, newBlock.position.y, newBlock.position.z)).type !== 0) {
                console.log(`Block update: ${oldBlock.name} at ${oldBlock.position} has been updated to ${newBlock.name} at ${newBlock.position}`)
                try {
                    await bot.equip(804, 'hand')
                    await bot.dig(newBlock, 'ignore', 'raycast')

                    let heldItem = bot.heldItem;
                
                    if (heldItem) {
                        console.log(`手上工具耐久度: ${(heldItem.maxDurability-heldItem.durabilityUsed).toFixed()} / ${heldItem.maxDurability}`); // durability of held item
                    }

                    if ((Number(heldItem.maxDurability-heldItem.durabilityUsed).toFixed()) <= 200) {
                        bot.chat(config.exp_warp)
                        await new Promise(r => setTimeout(r, 1000));
                        let now_durability = (Number(heldItem.maxDurability-heldItem.durabilityUsed).toFixed())

                        const fix_pickaxe = new Promise(async (resolve, reject) => {
                            while (now_durability < heldItem.maxDurability) {
                                heldItem = bot.heldItem;
                                await new Promise(r => setTimeout(r, 1000));
                                now_durability = (Number(heldItem.maxDurability-heldItem.durabilityUsed).toFixed())
                                console.log(now_durability)
                            }

                            resolve('fixed')
                        })

                        const timeoutpromise = new Promise((resolve, reject) => {
                            timeout = setTimeout(() => {
                                resolve('timeout')
                            }, 30000)
                        })

                        await Promise.race([fix_pickaxe, timeoutpromise])

                        bot.chat(config.mine_warp)
                        await new Promise(r => setTimeout(r, 1000))
                    }

                    await new Promise(r => setTimeout(r, 100))
                } catch (error) {}
            }
        }
    })

    bot.on("message", (jsonMsg) => {
        var regex = /Summoned to server(\d+) by CONSOLE/;
        if (regex.exec(jsonMsg.toString())) {
            bot.chat(config.server)
            bot.chat(config.warp)
        }

        if (jsonMsg.toString().startsWith('[領地] 您沒有')) {
            process.exit(1)
        }

        if (/^\[([A-Za-z0-9_]+) -> 您\] .*/.exec(jsonMsg.toString())) {
            const msg = jsonMsg.toString()
            const pattern = /^\[([A-Za-z0-9_]+) -> 您\] .*/;
            const match = pattern.exec(msg);
            if (match) {
                let playerid = match[1];
                if (playerid === bot.username) {return};
                let args = msg.slice(8 + playerid.length);
                const commandName = args.split(' ')[0].toLowerCase();

                switch (commandName) {
                    default:
                        bot.chat(`/m ${playerid} 此為 Jimmy 開發的 [廢土放方塊機器人] ，如有疑問請私訊 Discord: xiaoxi_tw`)
                        break
                }
            }
        }

        if (jsonMsg.toString().includes('目標生命 : ')) return

        console.log(jsonMsg.toAnsi());
    });

    bot.on("end", () => {
        console.log('[INFO] ' + `機器人已斷線，將於 5 秒後重啟`);
        for (listener of rl.listeners('line')) {
            rl.removeListener('line', listener)
        }
        
        setTimeout(initBot, 5000);
    });

    bot.on("kicked", (reason) => {
        console.log('[WARN] ' + `機器人被伺服器踢出\n原因：${reason}`);
    });

    bot.on("error", (err) => {
        if (err.code === "ECONNREFUSED") {
            console.log('[ERROR] ' + `連線到 ${err.address}:${err.port} 時失敗`);
        } else {
            console.log('[ERROR] ' + `發生無法預期的錯誤: ${err}`);
        }

        process.exit(1);
    });
};

initBot();

process.on("unhandledRejection", async (error) => {
    console.log(error)
    console.log('[ERROR] ' + error.message)
    process.exit(1)
});

process.on("uncaughtException", async (error) => {
    console.log(error)
    console.log('[ERROR] ' + error.message)
    process.exit(1)
});

process.on("uncaughtExceptionMonitor", async (error) => {
    console.log(error)
    console.log('[ERROR] ' + error.message)
    process.exit(1)
});