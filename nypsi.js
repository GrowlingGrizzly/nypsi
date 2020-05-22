const Discord = require("discord.js");
const { MessageEmbed } = require("discord.js");
const client = new Discord.Client();
const { prefix, token } = require("./config.json");
const fs = require("fs");
const { list } = require("./optout.json");
const { banned } = require("./banned.json");
const { getUserCount } = require("./economy/utils.js")
const { runCheck, hasGuild, createGuild } = require("./guilds/utils.js")
const { table, getBorderCharacters } = require("table")

const commands = new Discord.Collection();
const aliases = new Discord.Collection();
const cooldown = new Set()
const snipe = new Map()
let ready = false

let commandFiles 

function loadCommands() {
    console.log("loading commands..")
    const startTime = new Date().getTime()

    commandFiles = fs.readdirSync("./commands/").filter(file => file.endsWith(".js"));
    const failedTable = []

    if (commands.size > 0) {
        for (command of commands.keyArray()) {
            delete require.cache[require.resolve(`./commands/${command}.js`)]
        }
        commands.clear()
    }

    for (file of commandFiles) {
        let command
        
        try {
            command = require(`./commands/${file}`);

            let enabled = true;
        
            if (!command.name || !command.description || !command.run || !command.category) {
                enabled = false;
            }

            if (enabled) {
                commands.set(command.name, command);
            } else {
                failedTable.push([file, "❌"])
            }
        } catch (e) {
            failedTable.push([file, "❌"])
        }
    }

    const endTime = new Date().getTime()
    const timeTaken = endTime - startTime

    if (failedTable.length != 0) {
        console.log(table(failedTable, {border: getBorderCharacters("ramac")}))
    } else {
        console.log("all commands loaded without error ✅")
    }

    console.log("time taken: " + timeTaken + "ms")
}
exports.reloadCommands = loadCommands

loadCommands()

aliases.set("ig", "instagram");
aliases.set("av", "avatar");
aliases.set("whois", "user");
aliases.set("who", "user");
aliases.set("serverinfo", "server");
aliases.set("ws", "wholesome");
aliases.set("rick", "rickroll");
aliases.set("git", "github");
aliases.set("bal", "balance");
aliases.set("top", "baltop")
aliases.set("cf", "coinflip")
aliases.set("r", "roulette")
aliases.set("steal", "rob")
aliases.set("rps", "rockpaperscissors")
aliases.set("mc", "minecraft")
aliases.set("bunny", "rabbit")
aliases.set("lock", "lockdown")
aliases.set("ch", "channel")
aliases.set("colour", "color")
aliases.set("activity", "presence")
aliases.set("purge", "del")
aliases.set("penis", "pp")
aliases.set("bj", "blackjack")
aliases.set("bird", "birb")
aliases.set("dep", "deposit")
aliases.set("with", "withdraw")
aliases.set("bank", "balance")

client.once("ready", async () => {

    setTimeout(() => {
        client.user.setPresence({
            status: "dnd",
            activity: {
                name: "tekoh.wtf | $help | " + client.guilds.cache.size
            }
        });
    }, 5000)

    setInterval(() => {
        client.user.setPresence({
            status: "dnd",
            activity: {
                name: "tekoh.wtf | $help | " + client.guilds.cache.size
            }
        })
    }, 600000)

    console.log("\n--bot summary--")
    console.log("server count: " + client.guilds.cache.size.toLocaleString())
    console.log("user count: " + client.users.cache.size.toLocaleString())
    console.log("commands count: " + commands.size)
    console.log("users in currency: " + getUserCount())
    console.log("--bot summary--\n");

    console.log("logged in as " + client.user.tag + " @ " + getTimeStamp() + "\n- bot run log starting below -\n");
});

client.on("guildCreate", guild => {
    console.log("\x1b[36m[" + getTimeStamp() + "] joined new server '" + guild.name + "' new count: " + client.guilds.cache.size + "\x1b[37m")
    if (!hasGuild(guild)) {
        createGuild(guild)
    }
})

client.on("guildDelete", guild => {
    console.log("\x1b[36m[" + getTimeStamp() + "] removed from server '" + guild.name + "' new count: " + client.guilds.cache.size + "\x1b[37m")
})

client.on("rateLimit", () => {
    console.log("\x1b[31m[" + getTimeStamp() + "] BEING RATE LIMITED!!\x1b[37m")
})

client.on("guildMemberAdd", member => {
    runCheck(member.guild)
})

client.on("messageDelete", message => {

    if (!message) return

    if (!message.member) return

    if (message.content != "" && !message.member.user.bot && message.content.length > 1) {
        snipe.set(message.channel.id, message)

        exports.snipe = snipe
    }
})

const { isLocked } = require("./commands/softlock.js")
client.on("message", message => {

    if (!cooldown.has(message.channel.id) && isLocked(message.channel.id) && message.content.length > 250 && !message.content.startsWith("$softlock")) {
        message.delete().catch()
    }

    cooldown.add(message.channel.id)
        
    setTimeout(() => {
        cooldown.delete(message.channel.id)
    }, 5000)

    if (message.author.bot) return;
    if (!message.guild) return;
    if (!message.content.startsWith(prefix)) return;

    if (!ready) {
        return message.channel.send("❌ please wait before using commands")
    }

    if (!message.guild.me.hasPermission("SEND_MESSAGES")) return

    if (!message.guild.me.hasPermission("EMBED_LINKS")) {
        return message.channel.send("❌ i am lacking permission `EMBED_LINKS`")
    }

    if (!message.guild.me.hasPermission("MANAGE_MESSAGES")) {
        return message.channel.send("❌ i am lacking permission `MANAGE_MESSAGES`")
    }

    if (banned.includes(message.member.user.id)) {
        cooldown.add(message.member.user.id)

        setTimeout(() => {
            cooldown.delete(message.member.user.id)
        }, 10000)
        return message.channel.send("❌ you are banned from this bot").then(m => m.delete({ timeout: 2500}));
    }

    if (cooldown.has(message.member.user.id)) {
        return
    }

    cooldown.add(message.member.user.id)

    setTimeout(() => {
        cooldown.delete(message.member.user.id)
    }, 500)

    const args = message.content.substring(prefix.length).split(" ");

    const cmd = args[0].toLowerCase();

    if (cmd == "help") {
        logCommand(message, args);
        return helpCmd(message, args);
    }

    if (aliases.get(cmd)) {
        logCommand(message, args);
        return runCommand(aliases.get(cmd), message, args);
    }

    if (commands.get(cmd)) {
        logCommand(message, args);
        return runCommand(cmd, message, args);
    }
    
});

client.on("channelCreate", async ch => {
    if (!ch.guild) return
    const muteRole = ch.guild.roles.cache.find(r => r.name.toLowerCase() == "muted")

    if (!muteRole) return

    ch.updateOverwrite(muteRole,{
        SEND_MESSAGES: false,
        SPEAK: false,
        ADD_REACTIONS: false
    }).catch(() => {})
})

function logCommand(message, args) {
    args.shift();

    const server = message.guild.name

    console.log("\x1b[33m[" + getTimeStamp() + "] " + message.member.user.tag + ": '" + message.content + "' ~ '" + server + "'\x1b[37m");
}

function getTimeStamp() {
    const date = new Date();
    let hours = date.getHours().toString();
    let minutes = date.getMinutes().toString();
    let seconds = date.getSeconds().toString();

    if (hours.length == 1) {
        hours = "0" + hours;
    } 

    if (minutes.length == 1) {
        minutes = "0" + minutes;
    } 

    if (seconds.length == 1) {
        seconds = "0" + seconds;
    }

    const timestamp = hours + ":" + minutes + ":" + seconds;

    return timestamp
}

const { updateXp, getXp, userExists } = require("./economy/utils.js")
const xpCooldown = new Set()
function runCommand(cmd, message, args) {

    try {
        commands.get(cmd).run(message, args)
    } catch(e) {
        console.log(e)
    }

    try {
        if (!message.member) return
        if (!userExists(message.member)) return
    
        setTimeout(() => {
            try {
                if (!xpCooldown.has(message.member.user.id)) {
                    updateXp(message.member, getXp(message.member) + 1)
            
                    xpCooldown.add(message.member.user.id)
            
                    setTimeout(() => {
                        try {
                            xpCooldown.delete(message.member.user.id)
                        } catch {}
                    }, 45000)
                }
            } catch {}
        }, 10000)
    } catch {}
    
}

function getCmdName(cmd) {
    return commands.get(cmd).name;
}

function getCmdDesc(cmd) {
    return commands.get(cmd).description;
}

function getCmdCategory(cmd) {
    return commands.get(cmd).category;
}

function helpCmd(message, args) {
    if (!message.guild.me.hasPermission("EMBED_LINKS")) {
        return message.channel.send("❌ i am lacking permission: 'EMBED_LINKS'");
    }

    let fun = []
    let info = []
    let money = []
    let moderation = []
    let nsfw = []

    for (cmd of commands.keys()) {

        if (getCmdCategory(cmd) == "fun") {
            fun.push(cmd)
        }
        if (getCmdCategory(cmd) == "info") {
            info.push(cmd)
        }
        if (getCmdCategory(cmd) == "money") {
            money.push(cmd)}

        if (getCmdCategory(cmd) == "moderation") {
            moderation.push(cmd)
        }

        if (getCmdCategory(cmd) == "nsfw") {
            nsfw.push(cmd)
        }
    }

    let color;

    if (message.member.displayHexColor == "#000000") {
        color = "#FC4040";
    } else {
        color = message.member.displayHexColor;
    }

    if (args.length == 0 && args[0] != "fun" && args[0] != "info" && args[0] != "money" && args[0] != "mod" && args[0] != aliases) {

        const embed = new MessageEmbed()
            .setTitle("help")
            .setColor(color)
        
            .addField("fun", "$**help** fun", true)
            .addField("info", "$**help** info", true)
            .addField("money", "$**help** money", true)
            .addField("mod", "$**help** mod", true)
            .addField("nsfw", "$**help** nsfw", true)
            .addField("aliases", "$**help** aliases", true)

            .setFooter(message.member.user.tag + " | bot.tekoh.wtf")
        
        if (!list.includes(message.member.user.id)) {
            return message.member.send(embed).then( () => {
                message.react("✅");
            }).catch( () => {
                message.channel.send(embed).catch(() => {
                    return message.channel.send("❌ i may be lacking permission: 'EMBED_LINKS'");
                   });
            });
        }
        
        message.channel.send(embed).catch(() => {
            return message.channel.send("❌ i may be lacking permission: 'EMBED_LINKS'");
        });
    }

    if (args[0] == "fun") {

        let cmdList = ""

        for (command of fun) {
            cmdList = cmdList + "$**" + getCmdName(command) + "** " + getCmdDesc(command) + "\n"
        }

        const embed = new MessageEmbed()
            .setTitle("help")
            .setColor(color)
        
            .addField("fun commands", cmdList)

            .setFooter(message.member.user.tag + " | bot.tekoh.wtf")
        
        if (!list.includes(message.member.user.id)) {
            return message.member.send(embed).then( () => {
                message.react("✅");
            }).catch( () => {
                message.channel.send(embed).catch(() => {
                    return message.channel.send("❌ i may be lacking permission: 'EMBED_LINKS'");
                   });
            });
        }
        
        message.channel.send(embed).catch(() => {
            return message.channel.send("❌ i may be lacking permission: 'EMBED_LINKS'");
        });
    }

    if (args[0] == "info") {

        let cmdList = ""

        for (command of info) {
            cmdList = cmdList + "$**" + getCmdName(command) + "** " + getCmdDesc(command) + "\n"
        }

        const embed = new MessageEmbed()
            .setTitle("help")
            .setColor(color)
        
            .addField("info commands", cmdList)

            .setFooter(message.member.user.tag + " | bot.tekoh.wtf");
        
        if (!list.includes(message.member.user.id)) {
            return message.member.send(embed).then( () => {
                message.react("✅");
            }).catch( () => {
                message.channel.send(embed).catch(() => {
                    return message.channel.send("❌ i may be lacking permission: 'EMBED_LINKS'");
                   });
            });
        }
        
        message.channel.send(embed).catch(() => {
            return message.channel.send("❌ i may be lacking permission: 'EMBED_LINKS'");
        });
    }

    if (args[0] == "money") {

        let cmdList = ""

        for (command of money) {
            cmdList = cmdList + "$**" + getCmdName(command) + "** " + getCmdDesc(command) + "\n"
        }

        const embed = new MessageEmbed()
            .setTitle("help")
            .setColor(color)
        
            .addField("money commands", cmdList)

            .setFooter(message.member.user.tag + " | bot.tekoh.wtf")
        
        if (!list.includes(message.member.user.id)) {
            return message.member.send(embed).then( () => {
                message.react("✅");
            }).catch( () => {
                message.channel.send(embed).catch(() => {
                    return message.channel.send("❌ i may be lacking permission: 'EMBED_LINKS'");
                   });
            });
        }
        
        message.channel.send(embed).catch(() => {
            return message.channel.send("❌ i may be lacking permission: 'EMBED_LINKS'");
        });
    }

    if (args[0] == "mod") {

        let cmdList = ""

        for (command of moderation) {
            cmdList = cmdList + "$**" + getCmdName(command) + "** " + getCmdDesc(command) + "\n"
        }

        const embed = new MessageEmbed()
            .setTitle("help")
            .setColor(color)
        
            .addField("mod commands", cmdList)

            .setFooter(message.member.user.tag + " | bot.tekoh.wtf")
        
        if (!list.includes(message.member.user.id)) {
            return message.member.send(embed).then( () => {
                message.react("✅");
            }).catch( () => {
                message.channel.send(embed).catch(() => {
                    return message.channel.send("❌ i may be lacking permission: 'EMBED_LINKS'");
                   });
            });
        }
        
        message.channel.send(embed).catch(() => {
            return message.channel.send("❌ i may be lacking permission: 'EMBED_LINKS'");
        });
    }

    if (args[0] == "aliases") {
        cmdList = ""

        for (cmd of aliases.sort().keys()) {
            cmdList = cmdList + "$**" + cmd + "** -> $**" + aliases.get(cmd) + "**\n"
        }

        const embed = new MessageEmbed()
            .setTitle("help")
            .setColor(color)
        
            .addField("aliases", cmdList)

            .setFooter(message.member.user.tag + " | bot.tekoh.wtf")
        
        if (!list.includes(message.member.user.id)) {
            return message.member.send(embed).then( () => {
                message.react("✅");
            }).catch( () => {
                message.channel.send(embed).catch(() => {
                    return message.channel.send("❌ i may be lacking permission: 'EMBED_LINKS'");
                   });
            });
        }
        
        message.channel.send(embed).catch(() => {
            return message.channel.send("❌ i may be lacking permission: 'EMBED_LINKS'");
        });
    }
    
    if (args[0] == "nsfw") {

        let cmdList = ""

        for (command of nsfw) {
            cmdList = cmdList + "$**" + getCmdName(command) + "** " + getCmdDesc(command) + "\n"
        }

        const embed = new MessageEmbed()
            .setTitle("help")
            .setColor(color)
        
            .addField("nsfw commands", cmdList)

            .setFooter(message.member.user.tag + " | bot.tekoh.wtf")
        
        if (!list.includes(message.member.user.id)) {
            return message.member.send(embed).then( () => {
                message.react("✅");
            }).catch( () => {
                message.channel.send(embed).catch(() => {
                    return message.channel.send("❌ i may be lacking permission: 'EMBED_LINKS'");
                   });
            });
        }
        
        message.channel.send(embed).catch(() => {
            return message.channel.send("❌ i may be lacking permission: 'EMBED_LINKS'");
        });
    }

}

function reloadCommand(command) {
    commandFiles = fs.readdirSync("./commands/").filter(file => file.endsWith(".js"));
    try {
        commands.delete(command)
        try {
            delete require.cache[require.resolve(`./commands/${command}`)]
        } catch (e) {}
        
        const commandData = require(`./commands/${command}`);
    
        let enabled = true;
        
        if (!commandData.name || !commandData.description || !commandData.run || !commandData.category) {
            enabled = false;
        }
        
        if (enabled) {
            commands.set(commandData.name, commandData);
            console.log(commandData.name + " ✅");
            exports.commandsSize = commands.size
            return true
        } else {
            console.log(command + " ❌");
            exports.commandsSize = commands.size
            return false
        }
    } catch (e) {
        console.log(e)
        return false
    }
}

exports.commandsSize = commands.size
exports.aliasesSize = aliases.size
exports.snipe
exports.reloadCommand = reloadCommand

setTimeout(() => {
    client.login(token).then(() => {
        setTimeout(() => {
            ready = true
            runChecks()
        }, 2000)
    })
}, 1500)



function runChecks() {
    setInterval(() => {
        client.guilds.cache.forEach(guild => {
            if (!hasGuild(guild)) {
                createGuild(guild)
            } else {
                runCheck(guild)
            }
        })
    }, 45000)
}