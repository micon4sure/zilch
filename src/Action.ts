import _ from 'lodash'
import { Turn } from './Game'

class Token {
  token: String
  value: Number
  dice: Number[]
  constructor(token: String, value: Number, dice: Number[]) {
    this.token = token;
    this.value = value;
    this.dice = dice;
  }
}

class Action {
  turn: Turn;
  tokens: Token[]

  constructor(turn: Turn) {
    this.turn = turn;

    this.tokens = [
      new Token("one", 100, [1]),
      new Token("five", 50, [5]),
    ];
    let possibilities = [
      { token: "ones", value: 1000, face: 1 },
      { token: "twos", value: 200, face: 2 },
      { token: "threes", value: 300, face: 3 },
      { token: "fours", value: 400, face: 4 },
      { token: "fives", value: 500, face: 5 },
      { token: "sixes", value: 600, face: 6 },
    ]
    _.each(possibilities, possibility => {
      this.tokens.push(new Token(possibility.token, possibility.value, _.times(3, _.constant(possibility.face))));
      this.tokens.push(new Token(possibility.token + "es", possibility.value * 2, _.times(4, _.constant(possibility.face))));
      this.tokens.push(new Token(possibility.token + "eses", possibility.value * 4, _.times(5, _.constant(possibility.face))));
      this.tokens.push(new Token(possibility.token + "eseses", possibility.value * 8, _.times(6, _.constant(possibility.face))));
    })
  }

  actionPossible() {
    let possible = false;
    _.each(this.tokens, candidate => {
      if (this.turn.has(candidate.dice)) {
        possible = true;
        return false;
      }
      return true;
    });
    return possible;
  }

  parse(text: String, roll: Function, bank: Function, zilch: Function) {
    // split text by spaces
    let tokens = text.split(" ");

    let doRoll = false;
    let doBank = false;

    let taken = false;

    // for all the tokens in the text
    _.each(tokens, token => {
      // for all available tokens
      _.each(this.tokens, candidate => {
        // if this is a legit token
        if (token == candidate.token) {
          // and the token matches the dice
          if (this.turn.has(candidate.dice)) {
            // take the dice away from the turn
            this.turn.take(candidate.dice);
            // and add the point value
            this.turn.points += candidate.value;
            taken = true;
          }
        }
      });

      if (token == "roll") doRoll = true;
      else if (token == "bank") doBank = true;
    })

    if (doRoll && taken) roll();
    else if (doBank) bank();
  }
}

export default Action;