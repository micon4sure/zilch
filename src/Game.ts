import _ from 'lodash'

import Action from './Action'
import Database from './Database'
import convertDiceToSVG from './convert'
import Log from './Log'

export enum State {
  IDLE, GATHER, RUNNING, ENDING
}

export class Player {
  score: number
  id: string
  name: string
  zilch: number = 0;
  eliminated: boolean = false;

  constructor(id, name) {
    this.score = 0;
    this.id = id;
    this.name = name;
  }
}

export class Game {
  send: Function;
  state: State;
  players: Player[];
  startedBy: string;
  action: Action;
  turn: Turn;
  player: Player;
  playerNum: number = -1;
  ender: Player;
  limit: number;
  debug: boolean;

  constructor(send: Function, starterID: string, limit: number, debug = false) {
    this.send = send;
    this.state = State.IDLE;
    this.players = []
    this.startedBy = starterID;
    this.limit = limit;
    this.debug = debug;
  }

  join(player: Player) {
    if (_.find(this.players, candidate => candidate.id == player.id)) return;
    this.players.push(player);
  }

  start() {
    Log.startGame(this);
    this.state = State.RUNNING;
    this.playerNum = -1;
    this.next();
  }
  next() {
    if (this.playerNum + 1 >= this.players.length) {
      this.playerNum = -1;
    }

    const end = () => {
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

      Log.endGame();
      Database.saveGame(Log.get().getGameStats(winner));

      this.send(`${winner.name} wins! ($${winner.score}).`);
      this.state = State.IDLE;
      this.players = [];
      this.playerNum = -1;
      this.ender = undefined;

    };

    // move on to next player
    this.player = this.players[++this.playerNum];
    let eliminated = 0;

    // check if player is eliminated. if so, move on to next, if all players are eliminated, end.
    while (this.player.eliminated) {
      this.player = this.players[++this.playerNum];
      eliminated++;
      if (eliminated == this.players.length) {
        end();
        return;
      }
    }

    // if all players had their turn after the ender got a higher score than the limit, end the game
    if (this.state == State.ENDING && this.ender.id == this.player.id) {
      end();
      return;
    }
    this.send(`<@${this.player.id}> ($${this.player.score})`);

    // create new turn, roll dice
    this.turn = new Turn(Game.roll(6));
    Log.get().startTurn(this.player.id);
    this.sendDice();

    // create a new action for this turn, player can try to call this with tokens
    this.action = new Action(this.turn);
  }

  gather() {
    this.state = State.GATHER;
  }
  static roll(times) {
    return _.times(times, () => {
      let num = Math.random() * 6;
      return Math.ceil(num)
    });
  }

  isActivePlayer(id: string) {
    if (!this.player) return false;
    return this.player.id == id;
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

    result = input.match(/^(?<pluses>\++)$/)
    if (result !== null) {
      let steps = result.groups['pluses'].length;
      let previous = Log.get().getPreviousTokens(steps)
      tokens = _.clone(previous);
      tokens.push("roll");
    }

    result = input.match(/^(?<dice>[15]{1,4})(?<rollbank>[rb])$/)
    if (result !== null) {
      tokens = []
      _.each(result.groups['dice'], (die) => {
        tokens.push(die == 1 ? 'one' : 'five');
      })
      tokens.push(result.groups['rollbank'] == 'r' ? 'roll' : 'bank');
    }

    _.each(tokens, token => {
      if (token.toLowerCase() == "onro") {
        this.action.action("one")
        roll = true;
      } else if (token.toLowerCase() == "firo") {
        this.action.action("five")
        roll = true;
      } else if (token.toLowerCase() == "roll" || token.toLowerCase() == "rikk") {
        roll = true;
      } else if (token.toLowerCase() == "roll?") {
        if (Math.random() > .5)
          roll = true
        else
          bank = true
      } else if (token.toLowerCase() == "bank") {
        bank = true;
      } else if (token.toLowerCase() == "free") {
        this.action.action("free");
        roll = true;
      } else {
        this.action.action(token.toLowerCase());
      }
    });
    if (bank) {
      if (this.turn.points < 300) {
        this.send("No: < 300.");
      } else {
        Log.get().bank(this.turn.points, this.player.score, this.turn.dice, this.turn.taken);
        this.player.zilch = 0;
        this.player.score += this.turn.points;
        this.send(`+$${this.turn.points} -> $${this.player.score}`);

        if (this.player.score >= this.limit && this.state != State.ENDING) {
          this.ender = this.player;
          this.state = State.ENDING;
          this.send(`${this.player.name} @ $${this.player.score} >= $${this.limit}!`);
        }
        this.next();
        return;
      }
    }

    // roll logic
    else if (roll) {
      // if no dice have been taken, player is not allowed to roll
      if (!this.turn.taken.length)
        return;


      // check if no remaining dice -> new batch
      if (!this.turn.dice.length) {
        Log.get().roll(this.turn.points, this.player.score, this.turn.dice, this.turn.taken, false);
        this.turn.taken = [];
        this.turn.dice = Game.roll(6);
        this.send('$' + this.turn.points + ' ($' + (this.player.score + this.turn.points) + ')');
        this.sendDice();
        return;
      }

      // reroll the remaining dice
      this.turn.dice = Game.roll(this.turn.dice.length);

      // check if no remaining option to the player
      if (this.action.hasOptions()) {
        Log.get().roll(this.turn.points, this.player.score, this.turn.dice, this.turn.taken, false);
        this.turn.taken = [];
      } else {
        this.player.zilch++;
        Log.get().roll(this.turn.points, this.player.score, this.turn.dice, this.turn.taken, true);
        Log.get().zilch();

        if (this.player.zilch == 3) {
          this.sendDice("ZILCH x3! -$500.", true);
          this.player.score -= 500;
        } else if (this.player.zilch == 5) {
          this.sendDice("ZILCH x5! -$1000.", true);
          this.player.score -= 1000;
        } else if (this.player.zilch == 6) {
          this.player.eliminated = true;
          this.sendDice("ZILCH x6! ELIMINATED!", true);
        } else {
          this.sendDice("ZILCH!");
        }
        this.next();
        return;
      }
      this.sendDice();
    }
  }

  sendDice(comment = "", newline = false) {
    if (newline) {
      this.send(this.turn.dice.join(" "))
      this.send(comment)
      return;
    }
    this.send(this.turn.dice.join(" ") + " " + comment)
    // this.send({ files: [convertDiceToSVG(this.turn.dice)] });
  }
}


export class Turn {
  dice: number[];
  points: number;
  taken: number[] = [];

  constructor(dice: number[]) {
    this.dice = dice;
    this.points = 0;
  }

  has(dice: number[]) {
    let exclude: number[] = [];

    _.each(dice, (die, index) => {
      _.each(this.dice, (candidate, candidateIndex) => {
        if (_.includes(exclude, candidateIndex)) return null;

        if (candidate == die) {
          exclude.push(candidateIndex);
          // return false -> break _.each
          return false;
        }
        return null;
      });
    });
    return dice.length == exclude.length;
  }

  take(dice: number[]) {
    if (!this.has(dice)) {
      throw new Error("can't take what I don't have")
    }
    let exclude: number[] = [];

    _.each(dice, (die, index) => {
      _.each(this.dice, (candidate, candidateIndex) => {
        if (_.includes(exclude, candidateIndex)) return null;

        if (candidate == die) {
          exclude.push(candidateIndex);
          // return false = break each
          return false;
        }
        return null;
      });
    });
    this.taken = this.taken.concat(_.map(exclude, idx => this.dice[idx]));
    this.dice = _.filter(this.dice, (die, index) => !_.includes(exclude, index));
  }
}