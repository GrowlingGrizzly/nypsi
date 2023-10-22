import { CommandInteraction, Message } from "discord.js";
import { Command, NypsiCommandInteraction } from "../models/Command";
import { CustomEmbed, ErrorEmbed } from "../models/EmbedBuilders";
import { getBakeryUpgrades } from "../utils/functions/economy/bakery";
import { getBakeryUpgradesData } from "../utils/functions/economy/utils";
import { getMember } from "../utils/functions/member";
import { addCooldown, getResponse, onCooldown } from "../utils/handlers/cooldownhandler";

const cmd = new Command("bakery", "view your current bakery upgrades", "money");

async function run(
  message: Message | (NypsiCommandInteraction & CommandInteraction),
  args: string[],
) {
  if (await onCooldown(cmd.name, message.member)) {
    const embed = await getResponse(cmd.name, message.member);

    return message.channel.send({ embeds: [embed] });
  }

  await addCooldown(cmd.name, message.member, 7);

  let target = message.member;

  if (args.length > 0) {
    target = await getMember(message.guild, args.join(" "));

    if (!target)
      return message.channel.send({
        embeds: [new ErrorEmbed(`couldn't find a member matching \`${args.join(" ")}\``)],
      });
  }

  const upgrades = await getBakeryUpgrades(target);

  const embed = new CustomEmbed(
    target,
    upgrades
      .map(
        (u) =>
          `\`${u.amount.toLocaleString()}x\` ${getBakeryUpgradesData()[u.upgradeId].emoji} ${
            getBakeryUpgradesData()[u.upgradeId].name
          }`,
      )
      .join("\n"),
  ).setHeader(
    target.user.id === message.author.id ? "your bakery" : `${target.user.username}'s bakery`,
    target.user.avatarURL(),
  );

  return message.channel.send({ embeds: [embed] });
}

cmd.setRun(run);

module.exports = cmd;
