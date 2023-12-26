import _ from 'lodash'
import { Client, GatewayIntentBits } from 'discord.js'

import Game, { Game_CallbackHandler, Game_Event, Game_State } from './Game'
import Sender from './Sender'
import Config, { Config_Param } from './Config'
import Database from './Database'
import Player from './Player'
import Token from './Token'
import Turn from './Turn'

/**
 * Discord bot abstraction
 */
export default abstract class Bot {
  /**
   * Discord client
   */
  protected client: Client;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ],
    });
    this.client.login(Config.getParamUnsafe(this.constructor.name))
    console.log(this.constructor.name)

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
  protected game = null;
  private previousRoll = [];
  private previousTokens = [];
  private timeout;

  /**
   * Callbacks to be registered on games
   */
  callbacks = {}

  /**
   * Called when user tries to alter game state (create new, join, start), call passed functions according to game state
   * @param idle 
   * @param gather 
   * @param running 
   */
  handleStateInput(idle: Function, gather: Function, running: Function): void {
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
  handleStateInputDefault(send, author, value: number, arg): void {
    this.handleStateInput(
      () => {
        this.createGame(send, author.id, value);
        this.game.gather();
        this.addPlayer(new Player(author.id, author.username, author.bot))
        this.registerCallbacks();
        send(`started for ${value}. \`!join\` up`)

        if (arg !== undefined && arg == "y") {
          send('?join')
        }
      },
      () => send("round already started, `!join` up."),
      () => send("game is running.")
    )
  }

  /**
   * Clean up game, called when game ends or times out
   */
  cleanup() {
    clearTimeout(this.timeout);
    this.game.release();
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
    // register cleanup callback
    this.game.registerCallback(Game_Event.END, this.cleanup.bind(this));

    // register external callbacks
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
   * Create a game and set timeout
   * @param send 
   * @param starterId 
   * @param limit 
   */
  createGame(send, starterId, limit) {
    let game = new Game(send, starterId, limit)
    this.game = game;
    this.setTimeout();
  }
  /**
   * Join player and refresh timeout
   * @param player 
   */
  addPlayer(player: Player) {
    this.setTimeout();
    this.game.join(player);
  }
  /**
   * Time out gather after configured timeout (default 3min)
   */
  setTimeout() {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    this.timeout = setTimeout(() => {
      this.game.send("timed out.")
      this.cleanup();
    }, Config.getParam(Config_Param.TIMEOUT_GATHER));
  }
  /**
   * Clear timeout and start game
   */
  startGame() {
    clearTimeout(this.timeout);
    this.game.start();
  }

  /**
   * Clear timeout and reset game instance
   */
  abandonGame() {
    this.cleanup();
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
          send(`${stat.name}: ${stat.score}`);
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
      let command = chunks.shift().substring(1);
      let args = chunks;

      switch (command) {
        case "test":
          const limit = args[0] !== undefined ? args[0] : 300
          this.handleStateInputDefault(send, author, limit, null);
          this.startGame();
          break;
        case "zilch":
        case "z":
          this.handleStateInputDefault(send, author, 10000, args[0]);
          break;
        case "reset":
          if (!Config.isAdmin(author.id) && !author.bot) return;
          this.abandonGame();
          send("reset done.");
          break;
        case "stats":
        case "stat":
        case "s":
          if (!Config.getParam(Config_Param.STATISTICS)) {
            send("statistics not activated")
            break;
          }
          this.handleStats(send, args);
          break;
        case "turbo":
        case "t":
          this.handleStateInputDefault(send, author, 500, args[0]);
          break;
        case "rapid":
        case "r":
          this.handleStateInputDefault(send, author, 3000, args[0]);
          break;
        case "custom":
        case "c":
          this.handleStateInputDefault(send, author, args[0], args[1]);
          break;
        case "join":
        case "j":
          this.handleStateInput(
            () => send("no game running. go `!zilch`"),
            () => {
              this.addPlayer(new Player(author.id, author.username, author.bot));
              send("joined.")
            },
            () => send("game is running.")
          )
          break;
        case "goes":
        case "g":
          this.handleStateInput(
            () => {
              this.createGame(send, author.id, parseInt(args[0]));
              this.addPlayer(new Player(author.id, author.username, author.bot))
              this.registerCallbacks();
              this.startGame();
            },
            () => {
              if (this.game.startedBy != author.id) {
                this.addPlayer(new Player(author.id, author.username, author.bot));
              }
              this.startGame();
            },
            () => send("game already running.")
          )
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
  private clientId;

  onReady(event: any) {
    super.onReady(event)
    this.clientId = this.client.application.id;
  }
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
    let pattern = '<@' + this.clientId + '> \\*\\*([\\d ]+)\\*\\* \\(-?(\\d+);(-?\\d+);(\\d+)\\)'
    let result = message.match(pattern)
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
      case "?test":
        sender.send("!test")
        break;
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
        sender.send("!join")
        break;
      default:
        this.input(content, sender.send.bind(sender))
    }
  }
}
