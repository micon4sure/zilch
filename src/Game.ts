import _ from 'lodash'

import Action from './Action'
import convertDiceToSVG from './convert'

export enum State {
  IDLE, GATHER, RUNNING, ENDING
}

export class Player {
  score: number
  id: String
  name: String

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
  startedBy: String;
  action: Action;
  turn: Turn;
  player: Player;
  playerNum: number = -1;
  ender: String;
  limit: number;

  constructor(send: Function, starterID: String, limit: number) {
    this.send = send;
    this.state = State.IDLE;
    this.players = []
    this.startedBy = starterID;
    this.limit = limit;
  }

  join(player: Player) {
    if (_.find(this.players, candidate => candidate.id == player.id)) return;
    this.players.push(player);
  }

  start() {
    this.state = State.RUNNING;
    this.playerNum = -1;
    this.next();
  }
  next() {
    if (this.playerNum + 1 >= this.players.length) {
      this.playerNum = -1;
    }
    this.player = this.players[++this.playerNum];
    
    if (this.state == State.ENDING && this.ender == this.player.id) {
      let winner = _.reverse(_.orderBy(this.players, 'score'))[0];
      this.send(`${winner.name} wins! (${winner.score}).`);
      this.state = State.IDLE;
      this.players = [];
      this.playerNum = -1;
      this.ender = undefined;
      return;
    }
    this.send(`${this.player.name} (${this.player.score})`);
    this.turn = new Turn(Game.roll(6));
    this.sendDice();
    this.action = new Action(this.turn, (turn) => {
      turn.dice = Game.roll(turn.dice.length)
      this.sendDice();
    });
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

  isActivePlayer(id: String) {
    if (!this.player) return false;
    return this.player.id == id;
  }

  /**
   * Take player input, tokenize and take action on it.
   * If Roll is part of that input, fire it last.
   * @param input player input
   */
  input(input: String) {
    let tokens = input.split(" ");
    let roll = false;
    let bank = false;
    let free = false;
    _.each(tokens, token => {
      if (token.toLowerCase() == "roll") {
        roll = true;
      } else if (token.toLowerCase() == "bank") {
        bank = true;
      } else if (token.toLowerCase() == "free") {
        free = true;
      } else {
        this.action.action(token.toLowerCase());
      }
    });

    if (free) {
      if (this.turn.dice.length < 6)
        return;

      free = false;

      if (this.action.isStraight()) {
        free = true;
      }
      else if (!this.action.hasOptions(true)) {
        free = true;
      }
      else if (this.action.isThreePairs()) {
        free = true;
      }

      if (free) {
        this.turn.points += 1500;
        this.turn.dice = Game.roll(6);
        this.send('$' + this.turn.points);
        this.sendDice();
      }
    }
    if (bank) {
      if (this.turn.points < 300) {
        this.send("No: < 300.");
      } else {
        this.player.score += this.turn.points;
        this.send(`+${this.turn.points} -> $${this.player.score}`);
        
        if (this.player.score > this.limit) {
          this.ender = this.player.id;
          this.state = State.ENDING;
          this.send(`${this.player.name} @ ${this.player.score} > ${this.limit}!`);
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
        this.turn.dice = Game.roll(6);
        this.send('$' + this.turn.points);
        this.sendDice();
        return;
      }

      // reroll the remaining dice and reset the taken array
      this.turn.dice = Game.roll(this.turn.dice.length);
      this.turn.taken = [];
      this.sendDice();

      // check if no remaining option to the player
      if (!this.action.hasOptions()) {
        this.send("ZILCH!");
        this.next();
        return;
      }

    }
  }

  sendDice() {
    //this.send(this.turn.dice.join(" "))
    this.send({ files: [convertDiceToSVG(this.turn.dice)] });
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
    this.dice = _.filter(this.dice, (die, index) => !_.includes(exclude, index));
    this.taken = exclude;
  }
}