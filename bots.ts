import { Bot_Host, Bot_Player } from "./src/Bot";
import Config, { Config_Param } from "./src/Config";

new Bot_Host();

if (Config.getParam(Config_Param.BOT_PLAYER)) {
    new Bot_Player();
}
