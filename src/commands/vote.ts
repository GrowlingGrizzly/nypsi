import dayjs = require("dayjs");
import {
  ActionRowBuilder,
  BaseMessageOptions,
  ButtonBuilder,
  ButtonStyle,
  CommandInteraction,
  InteractionReplyOptions,
  Message,
  MessageActionRowComponentBuilder,
} from "discord.js";
import { Command, NypsiCommandInteraction } from "../models/Command";
import { CustomEmbed } from "../models/EmbedBuilders.js";
import Constants from "../utils/Constants";
import { getRawLevel } from "../utils/functions/economy/levelling";
import { createUser, userExists } from "../utils/functions/economy/utils";
import { getLastVote, hasVoted } from "../utils/functions/economy/vote";

const cmd = new Command("vote", "vote every 12 hours to get rewards", "money");

cmd.slashEnabled = true;

async function run(message: Message | (NypsiCommandInteraction & CommandInteraction)) {
  if (!(await userExists(message.member))) await createUser(message.member);

  const send = async (data: BaseMessageOptions | InteractionReplyOptions) => {
    if (!(message instanceof Message)) {
      let usedNewMessage = false;
      let res;

      if (message.deferred) {
        res = await message.editReply(data).catch(async () => {
          usedNewMessage = true;
          return await message.channel.send(data as BaseMessageOptions);
        });
      } else {
        res = await message.reply(data as InteractionReplyOptions).catch(() => {
          return message.editReply(data).catch(async () => {
            usedNewMessage = true;
            return await message.channel.send(data as BaseMessageOptions);
          });
        });
      }

      if (usedNewMessage && res instanceof Message) return res;

      const replyMsg = await message.fetchReply();
      if (replyMsg instanceof Message) {
        return replyMsg;
      }
    } else {
      return await message.channel.send(data as BaseMessageOptions);
    }
  };

  let rawLevel = await getRawLevel(message.member);

  if (rawLevel > 100) rawLevel = 100;

  const amount = Math.floor(15000 * (rawLevel / 13 + 1));
  const [voted, lastVote] = await Promise.all([
    hasVoted(message.member),
    getLastVote(message.member),
  ]);

  let crateAmount = 0;
  rawLevel = await getRawLevel(message.member);

  while (crateAmount === 0 && rawLevel > -1) {
    if (Constants.PROGRESSION.VOTE_CRATE.has(rawLevel)) {
      crateAmount = Constants.PROGRESSION.VOTE_CRATE.get(rawLevel);
    } else rawLevel--;
  }

  const embed = new CustomEmbed(message.member);

  if (voted) {
    const nextVote = dayjs(lastVote).add(12, "hours").unix();
    embed.setHeader("thank you for voting", message.author.avatarURL());
    embed.setColor(Constants.EMBED_SUCCESS_COLOR);
    embed.setDescription(`you can vote again <t:${nextVote}:R>`);
    send({ embeds: [embed] });
  } else {
    embed.setHeader("vote for nypsi", message.author.avatarURL());
    embed.setColor(Constants.EMBED_FAIL_COLOR);
    embed.addField(
      "rewards",
      `× **5**% multiplier booster\n× +$**50k** max bet\n× $**${amount.toLocaleString()}** reward\n× **${crateAmount}** vote crate${
        crateAmount > 1 ? "s" : ""
      }`,
    );

    const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setURL("https://top.gg/bot/678711738845102087/vote")
        .setLabel("top.gg"),
    );

    send({ embeds: [embed], components: [row] });
  }
}

cmd.setRun(run);

module.exports = cmd;
