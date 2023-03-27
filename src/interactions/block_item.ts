import prisma from "../init/database";
import redis from "../init/redis";
import { CustomEmbed } from "../models/EmbedBuilders";
import { InteractionHandler } from "../types/InteractionHandler";
import Constants from "../utils/Constants";
import { getBlockedList, setBlockedList } from "../utils/functions/economy/offers";
import { getItems, isEcoBanned } from "../utils/functions/economy/utils";

export default {
  name: "block-item",
  type: "interaction",
  async run(interaction) {
    if (!interaction.isButton()) return;
    if (await isEcoBanned(interaction.user.id)) return;

    if (await redis.exists(`${Constants.redis.nypsi.OFFER_PROCESS}:${interaction.user.id}`)) {
      return interaction.reply({
        embeds: [
          new CustomEmbed(null, "please wait until your offer has been processed").setColor(
            Constants.TRANSPARENT_EMBED_COLOR
          ),
        ],
        ephemeral: true,
      });
    }

    await redis.set(`${Constants.redis.nypsi.OFFER_PROCESS}:${interaction.user.id}`, "t");
    await redis.expire(`${Constants.redis.nypsi.OFFER_PROCESS}:${interaction.user.id}`, 69);

    const offer = await prisma.offer.findUnique({
      where: {
        messageId: interaction.message.id,
      },
    });

    if (!offer) {
      return await redis.del(`${Constants.redis.nypsi.OFFER_PROCESS}:${interaction.user.id}`);
    }

    await interaction.deferReply({ ephemeral: true });

    const current = await getBlockedList(interaction.user.id);

    if (!current.includes(offer.itemId)) current.push(offer.itemId);

    await setBlockedList(interaction.user.id, current);

    await redis.del(`${Constants.redis.nypsi.OFFER_PROCESS}:${interaction.user.id}`);

    return interaction.editReply({
      embeds: [
        new CustomEmbed(
          null,
          `✅ added ${getItems()[offer.itemId].emoji} ${getItems()[offer.itemId].name} to your block list`
        ),
      ],
    });
  },
} as InteractionHandler;
