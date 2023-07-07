import {
  BaseMessageOptions,
  CommandInteraction,
  InteractionReplyOptions,
  Message,
} from "discord.js";
import { NypsiCommandInteraction } from "../../../../models/Command";
import { CustomEmbed, ErrorEmbed } from "../../../../models/EmbedBuilders";
import { ItemUse } from "../../../../models/ItemUse";
import { hasPadlock, setPadlock } from "../balance";
import { getInventory, setInventoryItem } from "../inventory";

module.exports = new ItemUse(
  "padlock",
  async (message: Message | (NypsiCommandInteraction & CommandInteraction)) => {
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

    if (await hasPadlock(message.member)) {
      return send({
        embeds: [new ErrorEmbed("you already have a padlock on your balance")],
      });
    }

    const inventory = await getInventory(message.member, false);

    await Promise.all([
      setInventoryItem(
        message.member,
        "padlock",
        inventory.find((i) => i.item == "padlock").amount - 1,
        false,
      ),
      setPadlock(message.member, true),
    ]);

    return send({ embeds: [new CustomEmbed(message.member, "✅ your padlock has been applied")] });
  },
);
