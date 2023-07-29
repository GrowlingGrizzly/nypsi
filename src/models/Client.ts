import { ClusterClient } from "discord-hybrid-sharding";
import { Client, ClientOptions } from "discord.js";
import channelCreate from "../events/channelCreate";
import channelDelete from "../events/channelDelete";
import channelUpdate from "../events/channelUpdate";
import emojiCreate from "../events/emojiCreate";
import emojiDelete from "../events/emojiDelete";
import emojiUpdate from "../events/emojiUpdate";
import guildCreate from "../events/guildCreate";
import guildDelete from "../events/guildDelete";
import guildMemberAdd from "../events/guildMemberAdd";
import guildMemberRemove from "../events/guildMemberRemove";
import guildMemberUpdate from "../events/guildMemberUpdate";
import interactionCreate from "../events/interactionCreate";
import messageCreate from "../events/message";
import messageDelete from "../events/messageDelete";
import messageDeleteBulk from "../events/messageDeleteBulk";
import messageUpdate from "../events/messageUpdate";
import roleDelete from "../events/roleDelete";
import userUpdate from "../events/userUpdate";
import redis from "../init/redis";
import { doAutosellSitrep } from "../scheduled/clusterjobs/autosell_status";
import { runAuctionChecks } from "../scheduled/clusterjobs/checkauctions";
import { updateCounters } from "../scheduled/clusterjobs/counters";
import { runCraftItemsJob } from "../scheduled/clusterjobs/crafted";
import { runLotteryInterval } from "../scheduled/clusterjobs/lottery";
import { runLogs, runModerationChecks } from "../scheduled/clusterjobs/moderationchecks";
import { runNetWorthInterval } from "../scheduled/clusterjobs/networth-update";
import { runPremiumChecks } from "../scheduled/clusterjobs/premiumexpire";
import startRandomDrops from "../scheduled/clusterjobs/random-drops";
import { doLeaderboardSeed } from "../scheduled/clusterjobs/seed-leaderboards";
import { doTopGlobalDaily } from "../scheduled/clusterjobs/topglobal";
import { runPremiumCrateInterval } from "../scheduled/clusterjobs/weeklycrates";
import { runWorkerInterval } from "../scheduled/clusterjobs/workers";
import Constants from "../utils/Constants";
import { doChatReactions } from "../utils/functions/chatreactions/utils";
import { runEconomySetup } from "../utils/functions/economy/utils";
import { runChristmas } from "../utils/functions/guilds/christmas";
import { runCountdowns } from "../utils/functions/guilds/countdowns";
import { runSnipeClearIntervals } from "../utils/functions/guilds/utils";
import { openKarmaShop } from "../utils/functions/karma/karmashop";
import { startAutoMuteViolationInterval } from "../utils/functions/moderation/mute";
import { getCustomPresence, randomPresence, setCustomPresence } from "../utils/functions/presence";
import { getVersion } from "../utils/functions/version";
import { runCommandUseTimers } from "../utils/handlers/commandhandler";
import { getWebhooks, logger, setClusterId } from "../utils/logger";

export class NypsiClient extends Client {
  public cluster: ClusterClient<Client>;

  constructor(options: ClientOptions) {
    super(options);

    this.cluster = new ClusterClient(this);

    setClusterId(this.cluster.id);
    process.title = `nypsi v${getVersion()}: cluster ${this.cluster.id}`;

    runEconomySetup();

    if (this.cluster.maintenance) {
      logger.info(`started on maintenance mode with ${this.cluster.maintenance}`);
    }

    return this;
  }

  public loadEvents() {
    this.on("shardReady", (shardID) => {
      logger.info(`shard#${shardID} ready`);
    });
    this.on("shardDisconnect", (s, shardID) => {
      logger.info(`shard#${shardID} disconnected`);
    });
    this.on("shardError", (error1, shardID) => {
      logger.error(`shard#${shardID} error: ${error1}`);
    });
    this.on("shardReconnecting", (shardID) => {
      logger.info(`shard#${shardID} connecting`);
    });
    this.on("shardResume", (shardId) => {
      logger.info(`shard#${shardId} resume`);
    });

    this.cluster.on("message", (message: any) => {
      if (message._type) {
        if (message.alive) message.reply({ alive: true });
      }
    });

    this.cluster.once("ready", async () => {
      await redis.del(Constants.redis.nypsi.RESTART);
      this.on("guildCreate", guildCreate.bind(null, this));
      this.on("guildDelete", guildDelete.bind(null, this));
      this.rest.on("rateLimited", (rate) => {
        logger.warn("rate limit: " + rate.url);
      });
      this.on("guildMemberUpdate", guildMemberUpdate.bind(null));
      this.on("guildMemberAdd", guildMemberAdd.bind(null));
      this.on("guildMemberRemove", guildMemberRemove.bind(null));
      this.on("messageDelete", messageDelete.bind(null));
      this.on("messageUpdate", messageUpdate.bind(null));
      this.on("messageCreate", messageCreate.bind(null));
      this.on("messageDeleteBulk", messageDeleteBulk.bind(null));
      this.on("channelCreate", channelCreate.bind(null));
      this.on("channelDelete", channelDelete.bind(null));
      this.on("roleDelete", roleDelete.bind(null));
      this.on("userUpdate", userUpdate.bind(null));
      this.on("interactionCreate", interactionCreate.bind(null));
      this.on("channelUpdate", channelUpdate.bind(null));
      this.on("emojiCreate", emojiCreate.bind(null));
      this.on("emojiDelete", emojiDelete.bind(null));
      this.on("emojiUpdate", emojiUpdate.bind(null));

      await setCustomPresence();
      this.user.setPresence({
        status: "dnd",
        activities: [
          {
            name: "nypsi.xyz",
          },
        ],
      });

      setInterval(
        async () => {
          if (await getCustomPresence()) return;
          const presence = randomPresence();

          this.user.setPresence({
            status: "dnd",
            activities: [
              {
                name: presence,
              },
            ],
          });
        },
        30 * 60 * 1000,
      );

      setTimeout(async () => {
        this.runIntervals();
      }, 60000);
    });
  }

  private runIntervals() {
    getWebhooks(this);
    runSnipeClearIntervals();
    doChatReactions(this);
    runCommandUseTimers(this);
    startAutoMuteViolationInterval();

    if (this.cluster.id != 0) return;

    doTopGlobalDaily();
    runLotteryInterval(this);
    runPremiumCrateInterval(this);
    runPremiumChecks(this);
    runModerationChecks(this);
    runAuctionChecks(this);
    runCountdowns(this);
    runChristmas(this);
    updateCounters(this);
    openKarmaShop(this);
    startRandomDrops(this);
    runLogs();
    runWorkerInterval();
    runNetWorthInterval();
    runCraftItemsJob();
    doAutosellSitrep();
    doLeaderboardSeed();
  }
}
