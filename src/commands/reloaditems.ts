import { CommandInteraction, Message } from "discord.js";
import prisma from "../init/database";
import { NypsiClient } from "../models/Client";
import { Command, NypsiCommandInteraction } from "../models/Command";
import Constants from "../utils/Constants";
import { getTasksData, loadItems } from "../utils/functions/economy/utils";
import { logger } from "../utils/logger";

const cmd = new Command("reloaditems", "reload items", "none").setPermissions(["bot owner"]);

async function run(message: Message | (NypsiCommandInteraction & CommandInteraction)) {
  if (message.author.id != Constants.TEKOH_ID) return;

  loadItems();
  (message.client as NypsiClient).cluster.send("reload_items");

  prisma.task
    .deleteMany({
      where: {
        task_id: { notIn: Object.values(getTasksData()).map((i) => i.id) },
      },
    })
    .then((count) => {
      if (count.count > 0) logger.info(`${count} invalid tasks deleted`);
    });

  return (message as Message).react("✅");
}

cmd.setRun(run);

module.exports = cmd;
