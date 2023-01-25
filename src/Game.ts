import _ from 'lodash'

import Database from './Database'
import convertDiceToSVG from './convert'
import Token from './Token'
import Turn from './Turn'
import Player from './Player'
import Config, { Config_Param } from './Config'

export enum Game_State {
  GATHER, RUNNING, ENDING
}
export enum Game_Event {
  GAME, TURN, TOKEN, ROLL, REROLL, BANK, ZILCH, ELIMINATED, END
}

/**
 * Define interface for callback handlers
 */
export interface Game_CallbackHandler {
  registerCallback(event: Game_Event, callback: Function);
  activateCallbacks(event: Game_Event, data)
}

/**
 * Main game class. Handles player input via `Turn`, calls callbacks on events, rolls dice, etc.
 */
export default class Game implements Game_CallbackHandler {
  send: Function;
  state: Game_State;
  players: Player[];
  startedBy: string;
  turn: Turn;
  player: Player;
  playerNum: number = -1;
  ender: Player;
  limit: number;
  bot: boolean;
  winner: number;
  timeout;

  /**
   * callbacks to be registered, is initialized in constructor
   */
  callbacks = {
  };

  constructor(send: Function, starterID: string, limit: number) {
    this.send = send;
    this.state = Game_State.GATHER;
    this.players = []
    this.startedBy = starterID;
    this.limit = limit;

    // initialize callback array
    _.each(Game_Event, idx => {
      if (typeof idx == 'string') return;
      this.callbacks[idx] = []
    })
  }

  /**
   * "destructor"
   */
   public release() {
    if (this.timeout)
      clearTimeout(this.timeout)
  }

  /**
 * Take player input, tokenize and take action on it.
 * If Roll is part of that input, fire it last.
 * @param input player input
 */
  input(input: string) {
    let tokens = input.split(" ");
    let roll = false;
    let bank = false;
    let result;

    // 115r shorthand logic
    result = input.match(/^(?<dice>[15]{1,4})(?<rollbank>[rb])$/)
    if (result !== null) {
      tokens = []
      _.each(result.groups['dice'], (die) => {
        tokens.push(die == 1 ? 'one' : 'five');
      })
      tokens.push(result.groups['rollbank'] == 'r' ? 'roll' : 'bank');
    }

    _.each(tokens, token => {
      // onro, firo
      if (token.toLowerCase() == "onro") {
        this.turn.invoke("one")
        roll = true;
      } else if (token.toLowerCase() == "firo") {
        this.turn.invoke("five")
        roll = true;
      }
      // 'rikk', 'roll?'
      else if (token.toLowerCase() == "roll" || token.toLowerCase() == "rikk") {
        roll = true;
      } else if (token.toLowerCase() == "roll?") {
        if (Math.random() > .5)
          roll = true
        else
          bank = true
      }
      // bank
      else if (token.toLowerCase() == "bank") {
        bank = true;
      }
      // free
      else if (token.toLowerCase() == "free") {
        this.turn.invoke("free");
        roll = true;
      } else {
        // check input token
        this.turn.invoke(token.toLowerCase());
      }
    });

    //bank logic
    if (bank) {
      if (this.turn.points < 300) {
        this.send("No: < 300.");
      } else {
        this.activateCallbacks(Game_Event.BANK, { game: this });
        this.player.zilch = 0;
        this.player.score += this.turn.points;
        this.send(`+$${this.turn.points} -> $${this.player.score}`);

        if (this.player.score >= this.limit && this.state != Game_State.ENDING) {
          this.ender = this.player;
          this.state = Game_State.ENDING;
          this.send(`${this.player.name} @ $${this.player.score} >= $${this.limit}!`);
        }
        this.next();
        return;
      }
    }

    // roll logic
    else if (roll) {
      // if no dice have been taken, player is not allowed to roll
      if (!this.turn.taken.length) {
        return;
      }
      this.activateCallbacks(Game_Event.ROLL, { game: this });
      this.setTimeout();

      // check if no remaining dice -> new batch
      if (!this.turn.dice.length) {
        this.turn.taken = [];
        this.turn.dice = Game.roll(6);
        this.send('$' + this.turn.points + ' ($' + (this.player.score + this.turn.points) + ')');
        this.sendDice();
        this.activateCallbacks(Game_Event.REROLL, { game: this });
        return;
      }

      // reroll the remaining dice
      this.turn.dice = Game.roll(this.turn.dice.length);

      // check if zilch
      if (!this.turn.hasOptions()) {
        this.player.zilch++;

        if (this.player.zilch == 3) {
          this.activateCallbacks(Game_Event.ZILCH, { game: this, penalty: -500 });
          this.sendDice("ZILCH x3! -$500.", true, true);
          this.player.score -= 500;
        } else if (this.player.zilch == 5) {
          this.activateCallbacks(Game_Event.ZILCH, { game: this, penalty: -1000 });
          this.sendDice("ZILCH x5! -$1000.", true, true);
          this.player.score -= 1000;
        } else if (this.player.zilch == 6) {
          this.player.eliminated = true;
          this.activateCallbacks(Game_Event.ELIMINATED, { game: this });
          this.sendDice("ZILCH x6! ELIMINATED!", true, true);
        } else {
          this.activateCallbacks(Game_Event.ZILCH, { game: this, penalty: 0 });
          this.sendDice("ZILCH!", false, true);
        }
        this.next();
        return;
      } else {
        this.turn.taken = [];
      }
      this.sendDice();
    }
  }

  /**
   * Next turn.
   * Check if all players eliminated, end game if.
   * Check if limit has been reached, set game to ending if, end game if all players had their turn after.
   * Send dice to player
   */
  next() {
    const nextPlayer = () => {
      if (this.playerNum + 1 >= this.players.length) {
        this.playerNum = -1;
      }
      this.playerNum++;
    }

    // move on to next player
    nextPlayer();
    this.player = this.players[this.playerNum];
    let eliminated = 0;

    // check if player is eliminated. if so, move on to next, if all players are eliminated, end.
    while (this.player.eliminated) {
      nextPlayer();
      this.player = this.players[this.playerNum];
      eliminated++;
      if (eliminated == this.players.length) {
        this.send("all players eliminated!")
        this.activateCallbacks(Game_Event.END, { game: this });
        return;
      }
    }

    // if all players had their turn after the ender got a higher score than the limit, end the game
    if (this.state == Game_State.ENDING && this.ender.id == this.player.id) {
      // find player with highest score
      let highest = _.reverse(
        _.orderBy(
          _.filter(
            this.players, ['eliminated', false]
          ), 'score')
      )[0];

      // determine winner.
      // if the highest score isn't > than the ender's score, ender wins.
      let winner = (highest.score == this.ender.score)
        ? this.ender
        : highest;

      this.winner = winner;
      this.send(`${winner.name} wins! ($${winner.score}).`);
      this.activateCallbacks(Game_Event.END, { game: this });
      return;
    }

    // create new turn, roll dice
    this.turn = new Turn(this, Game.roll(6));
    this.activateCallbacks(Game_Event.TURN, { game: this });
    this.setTimeout();

    if (!this.player.bot) {
      this.send(`<@${this.player.id}> ($${this.player.score})`)
    }
    this.sendDice();
  }

    /**
   * Register a callback to be called on event
   * @param event 
   * @param callback 
   */
     registerCallback(event: Game_Event, callback: Function) {
      this.callbacks[event].push(callback)
    }
  
    /**
     * Activate all callbacks registered for event
     * @param event 
     * @param data 
     */
    async activateCallbacks(event: Game_Event, data = {}) {
      _.each(this.callbacks[event], async callback => {
        await callback(data)
      });
    }
  

  /**
   * Set/refresh timeout after which player is eliminated
   */
  setTimeout() {
    if (this.timeout)
      clearTimeout(this.timeout)
    this.timeout = setTimeout(() => {
      this.player.eliminated = true;
      this.send("player timed out")
      this.next();
    }, Config.getParam(Config_Param.TIMEOUT_TURN));
  }

  /**
   * Put the game in gather state
   */
   gather() {
    this.state = Game_State.GATHER;
  }

  /**
   * Register a player
   * @param player 
   */
   join(player: Player) {
    if (player.bot)
      this.bot = true;
    if (_.find(this.players, candidate => candidate.id == player.id)) return;
    this.players.push(player);
  }

  /**
   * Start the game
   */
  start() {
    this.state = Game_State.RUNNING;
    this.playerNum = -1;
    this.activateCallbacks(Game_Event.GAME, { game: this })
    this.next();
  }

  /**
   * Roll some dice
   * @param times 
   */
  static roll(times) {
    return _.times(times, () => {
      let num = Math.random() * 6;
      return Math.ceil(num)
    });
  }

  /**
   * Check if active player has id
   * @param id 
   */
  isActivePlayer(id: string): boolean {
    if (!this.player) return false;
    return this.player.id == id;
  }

  /**
   * Check if the game is active
   */
  isActive() {
    return this.state == Game_State.RUNNING || this.state == Game_State.ENDING
  }

  /**
   * Send the current dice to the players
   * @param comment string to be added to the dice
   * @param newline send comment on newline?
   * @param zilch player zilched?
   * @returns 
   */
  sendDice(comment = "", newline = false, zilch = false) {
    /**
     * spice up dice message with bold (or underline if game is ending) and zilch*'!'
     */
    let stringify = () => {
      let result = '';
      // default envelope: bold
      let envelope = '**';

      // if game is ending and user should be alerted to that, underline instead of bold
      if (Config.getParam(Config_Param.ALERT_ENDING) && (this.state == Game_State.ENDING)) {
        envelope = '__';
      }

      // if config is enabled and player has zilch value, alert them to it
      if (Config.getParam(Config_Param.ALERT_ZILCH) && this.player.zilch > 0) {
        _.times(this.player.zilch, () => result += '!');
        result += ' ';
      }

      // create dice string and return it
      result += envelope + this.turn.dice.join(" ") + envelope;
      return result;
    }

    // special bot syntax, only send if the bot didn't zilch and we want it to act on the dice
    if (this.player.bot && !zilch) {
      this.send("<@" + this.player.id + "> **" + this.turn.dice.join(" ") + "** (" + _.join([this.player.score, this.turn.points, this.player.zilch,], ";") + ")")
      return;
    }

    if (Config.getParam(Config_Param.EMOJI)) {
      if (comment.length) {
        this.send(comment);
      }
      this.send({ files: [convertDiceToSVG(this.turn.dice)] });
    } else {
      // actually send dice
      if (newline) {
        this.send(stringify())
        this.send(comment)
        return;
      }
      this.send(stringify() + " " + comment)
    }
  }
}