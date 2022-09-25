import { Bot_Host, Bot_Player } from "./src/Bot";
import Config, { Config_Param } from "./src/Config";
import History_Handler from "./src/History";

const host = new Bot_Host();
if (Config.getParam(Config_Param.STATISTICS)) {
    new History_Handler(host);
}

new Bot_Player();