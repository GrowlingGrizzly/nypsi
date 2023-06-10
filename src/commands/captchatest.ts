import { CommandInteraction, Message } from "discord.js";
import { Command, NypsiCommandInteraction } from "../models/Command";
import { toggleLock } from "../utils/functions/captcha";
import { getAdminLevel } from "../utils/functions/users/admin";
import { logger } from "../utils/logger";

const cmd = new Command("captchatest", "test an account", "none");

async function run(
  message: Message | (NypsiCommandInteraction & CommandInteraction),
  args: string[]
) {
  if ((await getAdminLevel(message.author.id)) < 1) return;

  if (args.length == 0) {
    return message.channel.send({ content: "dumbass" });
  }

  for (const user of args) {
    toggleLock(user, true);
    logger.info(`admin: ${message.author.username} (${message.author.id}) toggled ${user} captcha`);
  }

  if (!(message instanceof Message)) return;

  message.react("✅");
}

cmd.setRun(run);

module.exports = cmd;
