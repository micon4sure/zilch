import _ from 'lodash'
import { Game, Turn } from './Game'

class Token {
  token: String
  validator: Function
  callback: Function

  constructor(token: String, validator: Function, callback: Function) {
    this.token = token;
    this.validator = validator;
    this.callback = callback;
  }

  validate(turn: Turn) {
    return this.validator(turn);
  }

  action(turn: Turn) {
    this.callback(turn);
  }
}

const validatorHasDice = (dice: number[]) => {
  return (turn: Turn,) => {
    return turn.has(dice);
  }
}
const callbackDefault = (value: number, dice: number[]) => {
  return (turn: Turn,) => {
    turn.take(dice);
    turn.points += value;
  }
}

class Action {
  turn: Turn;
  tokens: Token[]

  constructor(turn: Turn, roll: Function) {
    this.turn = turn;

    this.tokens = [
      new Token("one", validatorHasDice([1]), callbackDefault(100, [1])),
      new Token("five", validatorHasDice([5]), callbackDefault(50, [5])),
    ];

    let possibilities = [
      { token: "ones", value: 1000, face: 1 },
      { token: "twos", value: 200, face: 2 },
      { token: "threes", value: 300, face: 3 },
      { token: "fours", value: 400, face: 4 },
      { token: "fives", value: 500, face: 5 },
      { token: "sixes", value: 600, face: 6 },
    ];
    _.each(possibilities, possibility => {
      let dice = _.times(3, _.constant(possibility.face));
      this.tokens.push(new Token(
        possibility.token,
        validatorHasDice(dice),
        callbackDefault(possibility.value, dice)
      ));
    });

    _.each(possibilities, possibility => {
      let dice = _.times(4, _.constant(possibility.face));
      this.tokens.push(new Token(
        possibility.token + "es",
        validatorHasDice(dice),
        callbackDefault(possibility.value * 2, dice)
      ));
    })

    _.each(possibilities, possibility => {
      let dice = _.times(5, _.constant(possibility.face));
      this.tokens.push(new Token(
        possibility.token + "eses",
        validatorHasDice(dice),
        callbackDefault(possibility.value * 4, dice)
      ));
    })

    _.each(possibilities, possibility => {
      let dice = _.times(6, _.constant(possibility.face));
      this.tokens.push(new Token(
        possibility.token + "eseses",
        validatorHasDice(dice),
        callbackDefault(possibility.value * 8, dice)
      ));
    });

    this.tokens.push(new Token("free",
      // free validator
      (turn: Turn) => {
        if (turn.dice.length == 6 && !this.hasOptions(true))
          return true;

        if (this.isThreePairs())
          return true;
      },
      // free callback
      (turn: Turn) => {
        if (turn.dice.length == 6 && !this.hasOptions(true)) {
          turn.points += 1500;
        } else if (this.isThreePairs()) {
          turn.points += 1000;
        }
        turn.dice = Game.roll(6);
      }
    ))
  }

  action(token: String) {
    _.each(this.tokens, candidate => {
      if (candidate.token != token)
        return;
      if (!candidate.validate(this.turn))
        return;
      candidate.action(this.turn);
    });
  }

  hasOptions(skipFree = false) {
    let options = false;
    _.each(this.tokens, token => {
      if (skipFree && token.token == "free") {
        return;
      }
      if (token.validate(this.turn)) {
        options = true;
        return false;
      }
    });

    return options;
  }

  isThreePairs() {
    if (this.turn.dice.length < 6)
      return false;
    let dice = _.clone(this.turn.dice);


    let num = dice.shift();
    _.each(dice, (die, index) => {
      if (die == num) {
        dice = _.filter(dice, (die, idx) => idx != index);
        return false;
      }
    })
    if (dice.length == 5) {
      return false;
    }

    num = dice.shift();
    _.each(dice, (die, index) => {
      if (die == num) {
        dice = _.filter(dice, (die, idx) => idx != index);
        return false;
      }
    })
    if (dice.length == 3) {
      return false;
    }

    num = dice.shift();
    return dice[0] == num;
  }

  isStraight() {
    return _.uniq(this.turn.dice).length == 6;
  }
}

export default Action;