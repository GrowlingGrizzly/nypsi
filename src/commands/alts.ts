import {
  ActionRowBuilder,
  BaseMessageOptions,
  ButtonBuilder,
  ButtonStyle,
  CommandInteraction,
  Guild,
  GuildMember,
  Interaction,
  InteractionReplyOptions,
  Message,
  MessageActionRowComponentBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { Command, NypsiCommandInteraction } from "../models/Command";
import { CustomEmbed } from "../models/EmbedBuilders.js";
import Constants from "../utils/Constants";
import { getPrefix } from "../utils/functions/guilds/utils";
import { getExactMember, getMember } from "../utils/functions/member";
import {
  addAlt,
  deleteAlt,
  getAlts,
  getMainAccount,
  isAlt,
  isMainAccount,
} from "../utils/functions/moderation/alts";
import { createProfile, profileExists } from "../utils/functions/moderation/utils";
import { getLastKnownUsername } from "../utils/functions/users/tag";
import { getResponse, onCooldown } from "../utils/handlers/cooldownhandler";

const cmd = new Command("alts", "view a user's alts", "moderation")
  .setAliases(["alt", "account", "accounts"])
  .setPermissions(["MANAGE_MESSAGES", "MODERATE_MEMBERS"]);

cmd.slashEnabled = false;
cmd.slashData.addStringOption((option) =>
  option.setName("user").setDescription("use the user's id or username").setRequired(true),
);

async function run(
  message: Message | (NypsiCommandInteraction & CommandInteraction),
  args: string[],
) {
  if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return;
    }
  }

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

  if (await onCooldown(cmd.name, message.member)) {
    const embed = await getResponse(cmd.name, message.member);

    return send({ embeds: [embed], ephemeral: true });
  }

  const prefix = await getPrefix(message.guild);

  if (args.length == 0) {
    const embed = new CustomEmbed(message.member)
      .setHeader("alts help")
      .addField(
        "info",
        "keep track of a user's alts in one easy place\n\nalts of a user can be automatically punished with their main\naccount when one is punished (/settings server alt-punish)\n[more info](https://docs.nypsi.xyz/moderation/alt-punish)",
      )
      .addField("usage", `${prefix}alts @user\n${prefix}alts <user ID or tag>`);

    return send({ embeds: [embed] });
  }

  if (!(await profileExists(message.guild))) await createProfile(message.guild);

  let member = (await getMember(message.guild, args.join(" "))) || args[0];

  if (await isAlt(message.guild, member instanceof GuildMember ? member.user.id : member)) {
    member = await getMember(
      message.guild,
      await getMainAccount(message.guild, member instanceof GuildMember ? member.user.id : member),
    );
  }

  const msg = await send({
    embeds: [await getEmbed(message, member)],
    components: [await getRow(message, member)],
  });

  const waitForButton = async (altMsg: Message): Promise<void> => {
    const filter = (i: Interaction) => i.user.id == message.author.id;

    const res = await msg.awaitMessageComponent({ filter, time: 30000 }).catch(async () => {
      await msg.edit({ components: [] });
    });

    if (!res) return;

    await res.deferReply();

    if (res.customId === "add-alt") {
      await res.editReply({
        embeds: [new CustomEmbed(message.member, "send user id")],
      });

      const msg = await message.channel
        .awaitMessages({
          filter: (msg: Message) => msg.author.id === message.author.id,
          max: 1,
          time: 30000,
        })
        .then((collected) => collected.first())
        .catch(() => {
          res.editReply({ embeds: [new CustomEmbed(message.member, "expired")] });
        });

      if (!msg) return;
      if (!msg.content.match(Constants.SNOWFLAKE_REGEX)) {
        await res.editReply({ embeds: [new CustomEmbed(message.member, "invalid user")] });
        return waitForButton(altMsg);
      }

      if (msg.content === (member instanceof GuildMember ? member.user.id : member)) {
        await res.editReply({ embeds: [new CustomEmbed(message.member, "invalid user")] });
        return waitForButton(altMsg);
      }

      if (await isMainAccount(message.guild, msg.content)) {
        await res.editReply({
          embeds: [
            new CustomEmbed(
              message.member,
              `\`${msg.content}\` is a main account, use **${prefix}alts ${msg.content}** to add an alt to them`,
            ),
          ],
        });
        return waitForButton(altMsg);
      }

      const addAltRes = await addAlt(
        message.guild,
        member instanceof GuildMember ? member.user.id : member,
        msg.content,
      );

      if (addAltRes)
        await res.editReply({
          embeds: [
            new CustomEmbed(
              message.member,
              `✅ added \`${msg.content}\` as an alt for ${
                member instanceof GuildMember ? member.user.username : `\`${member}\``
              }`,
            ),
          ],
        });
      else
        await res.editReply({
          embeds: [
            new CustomEmbed(
              message.member,
              `user is already an alt of ${await getExactMember(
                message.guild,
                await getMainAccount(message.guild, msg.content),
              )}`,
            ),
          ],
        });

      await altMsg.edit({
        embeds: [await getEmbed(message, member)],
        components: [await getRow(message, member)],
      });

      return waitForButton(altMsg);
    } else if (res.customId === "del-alt") {
      await res.editReply({
        embeds: [new CustomEmbed(message.member, "send user id")],
      });

      const msg = await message.channel
        .awaitMessages({
          filter: (msg: Message) => msg.author.id === message.author.id,
          max: 1,
          time: 30000,
        })
        .then((collected) => collected.first())
        .catch(() => {
          res.editReply({ embeds: [new CustomEmbed(message.member, "expired")] });
        });

      if (!msg) return;
      if (
        !(await isAlt(message.guild, msg.content)) ||
        (await getMainAccount(message.guild, msg.content)) !=
          (member instanceof GuildMember ? member.user.id : member)
      ) {
        await res.editReply({ embeds: [new CustomEmbed(message.member, "invalid alt")] });
        return waitForButton(altMsg);
      }

      await deleteAlt(message.guild, msg.content);
      await res.editReply({
        embeds: [
          new CustomEmbed(
            message.member,
            `✅ removed \`${msg.content}\` as an alt for ${
              member instanceof GuildMember ? member.user.username : `\`${member}\``
            }`,
          ),
        ],
      });
      await altMsg.edit({
        embeds: [await getEmbed(message, member)],
        components: [await getRow(message, member)],
      });
      return waitForButton(altMsg);
    }
  };
  return waitForButton(msg);
}

async function getEmbed(
  message: Message | (NypsiCommandInteraction & CommandInteraction),
  member: GuildMember | string,
) {
  const alts = await getUserAlts(message.guild, member);

  const embed = new CustomEmbed(message.member);

  if (!(member instanceof GuildMember)) {
    embed.setHeader("alts of " + member);
  } else {
    embed.setHeader("alts of " + member.user.username);
  }

  if (alts.length == 0) {
    embed.setDescription("no alts to display");
  } else {
    const altList: string[] = [];
    for (const alt of alts) {
      altList.push(
        `${
          (await getLastKnownUsername(alt.altId))
            ? (await getLastKnownUsername(alt.altId)) + " "
            : ""
        }\`${alt.altId}\``,
      );
    }
    embed.setDescription(altList.join("\n"));
  }

  return embed;
}

async function getRow(
  message: Message | (NypsiCommandInteraction & CommandInteraction),
  member: GuildMember | string,
) {
  const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder().setCustomId("add-alt").setLabel("add alt").setStyle(ButtonStyle.Success),
  );
  if ((await getUserAlts(message.guild, member)).length > 0)
    row.addComponents(
      new ButtonBuilder()
        .setCustomId("del-alt")
        .setLabel("remove alt")
        .setStyle(ButtonStyle.Danger),
    );

  return row;
}

async function getUserAlts(guild: Guild, member: GuildMember | string) {
  return await getAlts(guild, member instanceof GuildMember ? member.user.id : member).catch(
    () => [],
  );
}

cmd.setRun(run);

module.exports = cmd;
