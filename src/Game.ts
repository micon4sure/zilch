import _ from 'lodash'

import Parser from './Parser'

enum State {
  IDLE, GATHER, RUNNING
}

class Player {
  score: Number
  id: String
  name: String

  constructor(id, name) {
    this.score = 0;
    this.id = id;
    this.name = name;
  }
}

class Game {
  send: Function
  state: State
  players: Player[]
  startedBy: String
  parser: Parser

  constructor(send, starter) {
    this.send = send;
    this.state = State.IDLE;
    this.players = []
  }

  join(player: Player) {
    if (_.find(this.players, candidate => candidate.id == player.id)) return;
    this.players.push(player);
  }

  start() {
    this.state = State.RUNNING;
    let player = this.players[0];
    this.send(`${player.name}'s turn.`);
    const turn = new Turn(this.roll(6));
    this.send(turn.dice)

    this.parser = new Parser(turn);

  }

  gather() {
    this.state = State.GATHER;
  }
  roll(times) {
    return _.times(times, () => {
      let num = Math.random() * 6;
      return Math.ceil(num)
    });
  }

}


export class Turn {
  dice: Number[];
  points: Number;

  constructor(dice: Number[]) {
    this.dice = dice;
    this.points = 0;
  }

  has(dice: Number[]) {
    let exclude: Number[] = [];

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
      // console.log({
      //   d: this.dice, dice, exclude
      // })
    });
    return dice.length == exclude.length;
  }

  take(dice: Number[]) {
    if (!this.has(dice)) {
      throw new Error("can't take what I don't have")
    }
    let exclude: Number[] = [];

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
  }
}