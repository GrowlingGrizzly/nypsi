import { Manager } from "discord-hybrid-sharding";
import redis from "../../init/redis";
import requestDM from "../functions/requestdm";
import { logger } from "../logger";

let active = false;
let interval: NodeJS.Timer;
const promises: Promise<boolean>[] = [];

export function listenForDms(manager: Manager) {
  interval = setInterval(async () => {
    if (active) {
      clearInterval(interval);
      return;
    }

    if ((await redis.llen("nypsi:dm:queue")) != 0) {
      active = true;

      logger.debug("executing dm queue...");
      doDmQueueInterval(manager);
    }
  }, 10_000);
}

async function doDmQueueInterval(manager: Manager): Promise<void> {
  if ((await redis.llen("nypsi:dm:queue")) == 0) {
    await Promise.all(promises);

    promises.length = 0;

    active = false;
    logger.debug("dm queue finished");
    listenForDms(manager);
    return;
  }

  const item = JSON.parse(await redis.rpop("nypsi:dm:queue"));

  promises.push(
    requestDM({
      client: manager,
      content: item.payload.content,
      memberId: item.memberId,
      embed: item.payload.embed,
      components: item.payload.components,
    })
  );

  return doDmQueueInterval(manager);
}