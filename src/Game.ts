import _ from 'lodash'

import Action from './Action'

const mapDieFace = (die) => {
  return die;
  switch (die) {
    case 1:
      return "⚀";
    case 2:
      return "⚁";
    case 3:
      return "⚂";
    case 4:
      return "⚃";
    case 5:
      return "⚄";
    case 6:
      return "⚅";
  }
  return "..."
}

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
  ender: number;
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
    if (this.state == State.ENDING && this.ender == this.playerNum + 1) {
      let winner = _.reverse(_.orderBy(this.players, 'score'))[0];
      this.send(`${winner.name} wins the round with a score of ${winner.score}! Very good.`);
      this.state = State.IDLE;
      this.players = [];
      this.playerNum = -1;
      this.ender = undefined;
      return;
    }
    this.player = this.players[++this.playerNum];
    this.send(`${this.player.name}'s turn. (${this.player.score})`);
    this.turn = new Turn(Game.roll(6));
    this.send(_.join(this.turn.dice, " "));
    this.action = new Action(this.turn, (turn) => {
      turn.dice = Game.roll(turn.dice.length)
      this.send(this.turn.dice.join(" "));
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

    if(free) {
      if (this.turn.dice.length < 6)
        return;

      free = false;

      if(this.action.isStraight()) {
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
        this.sendDice();
      }
    }
    if (bank) {
      this.player.score += this.turn.points;
      this.next();
      return;
    }

    // roll logic
    else if (roll) {
      // if no dice have been taken, player is not allowed to roll
      if (!this.turn.taken.length)
        return;

      // check if no remaining dice -> new batch
      if (!this.turn.dice.length) {
        this.turn.dice = Game.roll(6);
        this.sendDice();
        return;
      }

      // reroll the remaining dice and reset the taken array
      this.turn.dice = Game.roll(this.turn.dice.length);
      this.turn.taken = [];
      this.sendDice();

      // check if no remaining option to the player
      if (!this.action.hasOptions()) {
        this.next();
        return;
      }

    }
  }

  sendDice() {
    this.send(this.turn.dice.join(" "));
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