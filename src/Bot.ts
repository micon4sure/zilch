import _ from 'lodash'
import { Client, Intents } from 'discord.js'

import Game, { Game_CallbackHandler, Game_Event, Game_State } from './Game'
import convertDiceToSVG from './convert'
import Sender from './Sender'
import Config, { Config_Param } from './Config'
import Database from './Database'
import Player from './Player'
import Token from './Token'
import Turn from './Turn'

/**
 * Discord bot abstraction
 */
abstract class Bot {
  protected client: Client;

  constructor() {
    this.client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });
    this.client.login(Config.getParamUnsafe(this.constructor.name))
    this.client.on('ready', this.onReady.bind(this));
    this.client.on('messageCreate', this.onMessage.bind(this));
  }

  onReady(event) {
    const name = this.constructor.name;
    console.log(`${name} connected and logged in.`);
  }

  protected abstract onMessage(message);
}

/**
 * Host bot. Handles game and stats
 */
export class Bot_Host extends Bot {
  private game: Game = null;
  private previousRoll = [];
  private previousTokens = [];

  callbacks = {}

  /**
   * Called when user tries to initialize a game, call passed functions according to game state
   * @param idle 
   * @param gather 
   * @param running 
   */
  initializeGame(idle: Function, gather: Function, running: Function): void {
    if (this.game === null) {
      idle();
    }
    else if (this.game.state == Game_State.GATHER) {
      gather();
    }
    else if (this.game.state == Game_State.RUNNING) {
      running();
    }
  }

  /**
   * Default game initializion
   * @param send 
   * @param author 
   * @param value 
   * @param arg 
   */
  initializeGameDefault(send, author, value: number, arg): void {
    this.initializeGame(
      () => {
        this.game = new Game(send, author.id, value);
        this.game.gather();
        this.game.join(new Player(author.id, author.username, author.bot))
        this.game.setFinalCallback(this.cleanup);
        this.registerCallbacks();
        send(`started for ${value}. \`!join\` up`)

        if (arg !== undefined && arg !== undefined) {
          send('?join')
        }
      },
      () => send("round already started, `!join` up."),
      () => send("game is running.")
    )
  }

  /**
   * Clean up game, called when game ends
   */
  cleanup() {
    this.game = null;
  }

  /**
   * Set a callback for an event, will later register on game
   * @param event 
   * @param callback 
   */
  setCallback(event: Game_Event, callback: Function) {
    this.callbacks[event] = callback;
  }

  /**
   * Register callbacks on game
   */
  registerCallbacks() {
    // regster external callbacks
    _.each(this.callbacks, (callback, event) => {
      this.game.registerCallback(event, callback);
    })

    // register prev handling callbacks
    this.game.registerCallback(Game_Event.TOKEN, (data) => {
      this.previousTokens.push(data.token)
    })
    const resetPrevious = () => {
      this.previousRoll = []
      this.previousTokens = []
    }
    this.game.registerCallback(Game_Event.TURN, resetPrevious)
    this.game.registerCallback(Game_Event.BANK, resetPrevious)
    this.game.registerCallback(Game_Event.ROLL, () => {
      this.previousRoll = this.previousTokens;
      this.previousTokens = []
    })
  }

  /**
   * Handle user calling !goes
   * @param send 
   * @param args 
   * @param author 
   */
  handleGoes(send, args, author) {
    this.initializeGame(
      () => {
        this.game = new Game(send, author.id, parseInt(args[0]))
        this.game.join(new Player(author.id, author.username, author.bot))
        this.game.setFinalCallback(this.cleanup);
        this.registerCallbacks();
        this.game.start()
      },
      () => {
        if (this.game.startedBy != author.id) {
          this.game.join(new Player(author.id, author.username, author.bot));
        }
        this.game.start();
      },
      () => send("game already running.")
    )
  }

  /**
   * Handle user calling !stat(s)
   * @param send 
   * @param args 
   * @returns Promise
   */
  async handleStats(send, args) {
    const sliceID = (arg) => arg.substring(2, arg.length - 1)
    let stats, winrate, startrate;
    switch (args[0]) {
      case "all":
        let id = sliceID(args[1])
        stats = await Database.getGeneralStats(id);
        winrate = (stats.wins / stats.games) * 100;
        startrate = (stats.started / stats.games) * 100;
        send(`${stats.wins} wins in ${stats.games} games (${winrate}%). Started ${stats.started} (${startrate}%). $${stats.winnings} in the bank`);
        break;
      case "games":
        stats = await Database.getGameStats();
        winrate = (stats.starterWin / stats.games) * 100;
        send(`${stats.games} games played. ${stats.starterWin} won by game starter (${winrate}%)`);
        break;
      case "money":
        stats = await Database.getMoneyStats();
        if (stats.length == 0) {
          send("no stats")
        }
        _.each(stats, stat => {
          send(`<@${stat.id}>: ${stat.score}`);
        })
        break;
      case "highest":
        const highest = await Database.getHighest();
        if (highest === undefined) {
          send("nothing valid recorded")
          return;
        }
        const date = new Date(highest.date);
        const datestring = (date.getFullYear() + '-' + ("0" + (date.getMonth() + 1)).slice(-2) + '-' + ("0" + date.getDate()).slice(-2) + ' ' + ("0" + date.getHours()).slice(-2) + ":" + ("0" + date.getMinutes()).slice(-2));
        send(`${highest.player} : ${highest.over} over ${highest.limit} @ ${datestring}`);
        break;
      default:
        send("all <id>; games; money; higehst");
        break;
    }
  }

  /**
   * Act on user message
   * @param message 
   * @returns Promise
   */
  async onMessage(message) {
    let { channelId, author, content } = message;
    if (!_.includes(Config.getParam(Config_Param.CHANNELS), channelId)) {
      return;
    }
    const sender = new Sender((text) => {
      message.channel.send(text)
    });
    let send = sender.send.bind(sender);

    if (content.substring(0, 1) == '!') {
      let chunks = content.split(" ");
      let command = chunks.shift();
      command = command.substring(1, command.length);
      let args = chunks;

      switch (command) {
        case "zilch":
        case "z":
          this.initializeGameDefault(send, author, 10000, args[0]);
          break;
        case "reset":
          if (!Config.isAdmin(author.id) && !author.bot) return;
          this.game = null
          send("reset done.")
          break;
        case "s":
        case "stat":
        case "stats":
          if (!Config.getParam(Config_Param.STATISTICS)) {
            send("statistics not activated")
            break;
          }
          this.handleStats(send, args);
          break;
        case "turbo":
        case "t":
          this.initializeGameDefault(send, author, 500, args[0]);
          break;
        case "rapid":
        case "r":
          this.initializeGameDefault(send, author, 3000, args[0]);
          break;
        case "custom":
        case "c":
          this.initializeGameDefault(send, author, args[0], args[1]);
          break;
        case "join":
        case "j":
          this.initializeGame(
            () => send("no game running. go `!start`"),
            () => {
              this.game.join(new Player(author.id, author.username, author.bot));
              send("joined.")
            },
            () => send("game is running.")

          )
          break;
        case "test":
          const limit = args[0] !== undefined ? args[0] : 300
          this.initializeGameDefault(send, author, limit, null);
          this.game.start();
          break;
        case "goes":
        case "g":
          this.handleGoes(send, args, author);
          break;
      }
    } else {
      // message is not a command, assume is game input
      if (this.game === null)
        return;
      if (this.game.isActivePlayer(author.id) && this.game.isActive()) {
        if (content == '+') {
          if (this.previousRoll.length > 0) {
            this.game.input(_.join(this.previousRoll, ' ') + ' roll')
          }
        } else {
          this.game.input(content);
        }
      }
    }
  }
}

/**
 * Empty callback handler for usage in Bot_Player
 */
class EmptyCallbackHandler implements Game_CallbackHandler {
  registerCallback(event: Game_Event, callback: Function) { }
  activateCallbacks(event: Game_Event, data) { }
}

/**
 * PlayerBot. Joins and plays games
 */
export class Bot_Player extends Bot {
  /**
   * Create tokens for play
   * @param score 
   * @param points 
   * @param zilch 
   * @param dice 
   * @returns string[]
   */
  decide(score, points, zilch, dice): string[] {
    let turn = new Turn(new EmptyCallbackHandler(), dice);

    let invoke = []

    while (true) {
      // find possible tokens
      let possibilities = [];
      _.each(Token.getAll(), token => {
        if (token.validate(turn)) {
          possibilities.push({ value: token.points(turn), token: token.token });
        }
      })
      // filter and sort possibilities by point value
      possibilities = _.reverse(_.sortBy(possibilities, ['value']));
      possibilities = _.filter(possibilities, possibility => possibility.token != "ibe")

      // until no more possibilities
      if (possibilities.length == 0) {
        break;
      }

      // invoke the tokens on the simulated turn to see what's left
      turn.invoke(possibilities[0].token);
      dice = turn.dice;
      invoke.push(possibilities[0].token)
    }

    // if there are no more dice or can't bank yet, roll.
    if (turn.dice.length == 0 || parseInt(points) + turn.points < 300) {
      invoke.push("roll");
    } else {
      // always bank if possible when zilch is > 1
      if (zilch > 1) {
        invoke.push("bank")
      } else {
        // otherwise, bank at > 750 or roll if less
        invoke.push(points + turn.points >= 750 ? "bank" : "roll")
      }
    }

    // return the tokens to invoke as an array of strings
    return invoke
  }

  /**
   * Act on a message if it's special bot player format
   * @param message 
   * @param send 
   */
  input(message, send) {
    // check is message for bot
    let result = message.match(/<@1022764408734232620> \*\*([\d ]+)\*\* \(-?(\d+);(-?\d+);(\d+)\)$/)
    if (result !== null) {
      let dice = _.map(result[1].split(" "), num => parseInt(num))
      let score = parseInt(result[2])
      let points = parseInt(result[3])
      let zilch = result[4]
      let tokens = this.decide(score, points, zilch, dice);
      setTimeout(() => {
        // send tokens to discord
        send(tokens.join(" "))
      }, 1000);
    }
  }

  /**
   * discord message handler
   * @param message 
   */
  onMessage(message) {
    let { channelId, author, content } = message;
    const sender = new Sender((text) => {
      message.channel.send(text)
    });

    switch (content) {
      case "?zilch":
      case "?z":
        sender.send("!zilch");

      case "?rapid":
      case "?r":
        sender.send("!rapid")
        break;
      case "?turbo":
      case "?t":
        sender.send("!turbo")
        break;
      case "?join":
      case "?j":
        if (!Config.isAdmin(author.id) && !author.bot) return;
        sender.send("!join")
        break;
      default:
        this.input(content, sender.send.bind(sender))
    }
  }
}
