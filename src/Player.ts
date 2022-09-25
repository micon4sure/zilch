/**
 * Reflect a player on discord. May be a bot.
 */
export default class Player {
    score: number
    id: string
    name: string
    zilch: number = 0;
    eliminated: boolean = false;
    bot: boolean = false;
  
    constructor(id, name, bot) {
      this.score = 0;
      this.id = id;
      this.name = name;
      this.bot = bot;
    }
  }
  