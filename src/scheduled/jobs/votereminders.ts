import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageActionRowComponentBuilder,
} from "discord.js";
import prisma from "../../init/database";
import redis from "../../init/redis";
import { CustomEmbed, getColor } from "../../models/EmbedBuilders";
import { Job } from "../../types/Jobs";
import { NotificationPayload } from "../../types/Notification";
import Constants from "../../utils/Constants";
import { addNotificationToQueue } from "../../utils/functions/users/notifications";
import dayjs = require("dayjs");

const queued = new Set<string>();

export default {
  name: "vote reminders",
  cron: "0 * * * *",
  run: async (log) => {
    const userIds = await prisma.dMSettings.findMany({
      where: {
        AND: [
          { voteReminder: true },
          {
            user: {
              Economy: {
                lastVote: { lte: dayjs().subtract(11, "hours").toDate() },
              },
            },
          },
        ],
      },
      select: {
        userId: true,
        user: {
          select: {
            Economy: {
              select: {
                lastVote: true,
                voteStreak: true,
              },
            },
          },
        },
      },
    });

    let amount = 0;

    for (const user of userIds) {
      if (
        (await redis.sismember(Constants.redis.nypsi.VOTE_REMINDER_RECEIVED, user.userId)) ||
        queued.has(user.userId)
      )
        continue;

      amount++;

      const payload: NotificationPayload = {
        memberId: user.userId,
        payload: {
          embed: new CustomEmbed()
            .setDescription("it has been more than 12 hours since you last voted")
            .setColor(getColor(user.userId))
            .setFooter({ text: `streak: ${user.user.Economy.voteStreak.toLocaleString()}` }),
          components: new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Link)
              .setURL("https://top.gg/bot/678711738845102087/vote")
              .setLabel("top.gg")
              .setEmoji("<:topgg:1355915569286610964>"),
          ),
        },
      };

      if (
        user.user.Economy.lastVote.getTime() <= dayjs().subtract(12, "hours").toDate().getTime()
      ) {
        await addNotificationToQueue(payload);

        await redis.sadd(Constants.redis.nypsi.VOTE_REMINDER_RECEIVED, user.userId);
      } else {
        queued.add(user.userId);
        setTimeout(
          () => {
            queued.delete(user.userId);
            redis.sadd(Constants.redis.nypsi.VOTE_REMINDER_RECEIVED, user.userId);
            addNotificationToQueue(payload);
          },
          user.user.Economy.lastVote.getTime() - dayjs().subtract(12, "hours").toDate().getTime(),
        );
      }
    }

    if (amount > 0) log(`${amount} vote reminders queued`);
  },
} satisfies Job;
