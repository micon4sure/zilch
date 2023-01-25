import _ from 'lodash'

export enum Config_Param {
  ADMINS = 'admins',
  CHANNELS = 'channels',
  BOT_HOST = 'Bot_Host',
  BOT_PLAYER = 'Bot_Player',
  STATISTICS = 'statistics',
  DB_USER = 'db_user',
  DB_PASSWORD = 'db_password',
  ALERT_ZILCH = 'alert_zilch',
  ALERT_ENDING = 'alert_ending',
  EMOJI = 'emoji',
  TIMEOUT_GATHER = 'timeout_gather',
  TIMEOUT_TURN = 'timeout_turn'
}

export default class Config {
  /**
   * lazily loaded config
   */
  static config = null;

  /**
   * Check id is in config admin array
   * @param id
   * @returns boolean
   */
  static isAdmin(id) {
    return _.includes(Config.getParam(Config_Param.ADMINS), id);
  }

  /**
   * Lazily load config
   * @returns object
   */
  static getConfig(): object {
    if (Config.config !== null)
      return Config.config;
    try {
      Config.config = require('../config.json');
      return Config.config
    } catch (err) {
      console.log("need config")
      process.exit()
    }
  }

  /**
   * Get config param by enum
   * @param name 
   * @returns mixed
   */
  static getParam(name: Config_Param) {
    return Config.getConfig()[name]
  }
  /**
   * Get config param by string
   * @param name 
   * @returns mixed
   */
  static getParamUnsafe(name: string) {
    return Config.getConfig()[name]
  }
}