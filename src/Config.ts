export default class Config {
    static readConfig() {
        let config
        try {
          return config = require('../config.json');
        } catch (err) {
          console.log('config file not found, should be in format ' + JSON.stringify({
            "channel": "discord channel id",
            "admin": "discord user id",
            "token": "discord bot auth token",
            "database_user": "arangoDbUserName",
            "database_password": "arangoDbUserPassword",
          }));
          process.exit()
        }
    }
    static getParam(name: string) {
        return this.readConfig()[name]
    }
}