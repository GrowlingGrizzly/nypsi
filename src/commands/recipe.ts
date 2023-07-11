import { CommandInteraction, Message } from "discord.js";
import { Command, NypsiCommandInteraction } from "../models/Command";
import { CustomEmbed, ErrorEmbed } from "../models/EmbedBuilders";
import { selectItem } from "../utils/functions/economy/inventory";
import { createUser, userExists } from "../utils/functions/economy/utils";
import { addCooldown, getResponse, onCooldown } from "../utils/handlers/cooldownhandler";

const cmd = new Command("recipe", "view the recipe for a craftable item", "money").setAliases([
  "howcraftthing",
]);

async function run(
  message: Message | (NypsiCommandInteraction & CommandInteraction),
  args: string[],
) {
  if (!(await userExists(message.member))) await createUser(message.member);

  if (await onCooldown(cmd.name, message.member)) {
    const embed = await getResponse(cmd.name, message.member);

    return message.channel.send({ embeds: [embed] });
  }

  if (args.length == 0) {
    return message.channel.send({ embeds: [new ErrorEmbed("/recipe <item>")] });
  }

  const selected = selectItem(args.join(" ").toLowerCase());

  if (!selected) {
    return message.channel.send({ embeds: [new ErrorEmbed(`couldnt find \`${args.join(" ")}\``)] });
  }

  if (!selected.craft || selected.craft.ingredients.length == 0) {
    return message.channel.send({ embeds: [new ErrorEmbed(`that item is not craftable`)] });
  }

  await addCooldown(cmd.name, message.member, 4);

  const embed = new CustomEmbed(message.member).setHeader(
    `${selected.emoji} ${selected.name} recipe`,
  );

  const desc: string[] = [];

  selected.craft.ingredients.forEach((ingredient) => {
    const item = selectItem(ingredient.split(":")[0]);
    desc.push(`* ${ingredient.split(":")[1]} ${item.emoji} ${item.name}`);
  });

  embed.setDescription(desc.join("\n"));

  return message.channel.send({ embeds: [embed] });
}

cmd.setRun(run);

module.exports = cmd;
