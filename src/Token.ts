import _ from 'lodash'
import Turn from './Turn'

/**
 * Represents a token a player can invoke when it's their turn.
 * examples are one, fiveses, free
 */
export default class Token {
  /**
   * The actual token like "ones"
   */
  token: string
  /**
   * Validate if token may be invoked
   */
  validator: Function
  /**
   * Callback for when token has been invoked
   */
  callback: Function
  /**
   * Callback to return points gotten by token
   */
  points: Function

  /**
   * All possible tokens, lazily loaded
   */
  private static ALL = null;

  constructor(token: string, validator: Function, callback: Function, points: Function) {
    this.token = token;
    this.validator = validator;
    this.callback = callback;
    this.points = points;
  }

  /**
   * Validate if token may be invoked on turn
   * @param turn
   * @returns 
   */
  validate(turn: Turn): boolean {
    return this.validator(turn);
  }

  /**
   * Invoke torken on turn
   * @param turn 
   */
  invoke(turn: Turn): void {
    this.callback(turn);
  }

  /**
   * Create a default callback to see if certain dice are presend in the turn
   * @param dice
   * @returns Function
   */
  static hoValidatorHasDice(dice: number[]): Function {
    return (turn: Turn,) => {
      return turn.has(dice);
    }
  }

  /**
   * Create a default callback when invoking a token which will take the dice off the turn and add the points
   * @param value
   * @param dice 
   * @returns Function
   */
  static hoDefaultCallbackInvoke(value: number, dice: number[]): Function {
    return (turn: Turn,) => {
      turn.take(dice);
      turn.points += value;
    }
  }

  /**
   * Create a default callback that will return how many points a token is worth
   * @param points 
   * @returns Function
   */
  static hoDefaultCallbackPoints(points): Function {
    return (turn: Turn) => points;
  }

  /**
   * Lazily load all tokens
   */
  static getAll() {
    if (Token.ALL !== null) {
      return Token.ALL;
    }

    // add mono tokens
    let tokens = [
      new Token("one", Token.hoValidatorHasDice([1]), Token.hoDefaultCallbackInvoke(100, [1]), Token.hoDefaultCallbackPoints(100)),
      new Token("ibe", Token.hoValidatorHasDice([1]), Token.hoDefaultCallbackInvoke(100, [1]), Token.hoDefaultCallbackPoints(100)),
      new Token("five", Token.hoValidatorHasDice([5]), Token.hoDefaultCallbackInvoke(50, [5]), Token.hoDefaultCallbackPoints(50)),
    ];

    // tri+ token data
    let possibilities = [
      { token: "ones", value: 1000, face: 1 },
      { token: "twos", value: 200, face: 2 },
      { token: "threes", value: 300, face: 3 },
      { token: "fours", value: 400, face: 4 },
      { token: "fives", value: 500, face: 5 },
      { token: "sixes", value: 600, face: 6 },
    ];

    // add triple tokens
    _.each(possibilities, possibility => {
      let dice = _.times(3, _.constant(possibility.face));
      tokens.push(new Token(
        possibility.token,
        Token.hoValidatorHasDice(dice),
        Token.hoDefaultCallbackInvoke(possibility.value, dice),
        Token.hoDefaultCallbackPoints(possibility.value)
      ));
    });

    // add tetra (quad) tokens
    _.each(possibilities, possibility => {
      let dice = _.times(4, _.constant(possibility.face));
      tokens.push(new Token(
        possibility.token + "es",
        Token.hoValidatorHasDice(dice),
        Token.hoDefaultCallbackInvoke(possibility.value * 2, dice),
        Token.hoDefaultCallbackPoints(possibility.value * 2)
      ));
    })

    // add penta tokens
    _.each(possibilities, possibility => {
      let dice = _.times(5, _.constant(possibility.face));
      tokens.push(new Token(
        possibility.token + "eses",
        Token.hoValidatorHasDice(dice),
        Token.hoDefaultCallbackInvoke(possibility.value * 4, dice),
        Token.hoDefaultCallbackPoints(possibility.value * 4)
      ));
    })

    // add hexa tokens
    _.each(possibilities, possibility => {
      let dice = _.times(6, _.constant(possibility.face));
      tokens.push(new Token(
        possibility.token + "eseses",
        Token.hoValidatorHasDice(dice),
        Token.hoDefaultCallbackInvoke(possibility.value * 8, dice),
        Token.hoDefaultCallbackPoints(possibility.value * 8)
      ));
    });

    // add special free token
    tokens.push(new Token("free",
      // validator
      (turn: Turn) => {
        if (turn.dice.length == 6 && !turn.hasOptions(true))
          return true;

        if (turn.isThreePairs())
          return true;

        if (turn.isStraight())
          return true;
      },
      // callback
      (turn: Turn) => {
        if (turn.dice.length == 6 && !turn.hasOptions(true)) {
          turn.points += 1500;
        } else if (turn.isThreePairs()) {
          turn.points += 1000;
        } else if (turn.isStraight()) {
          turn.points += 1500;
        }
        turn.take(turn.dice);
      },
      // points
      (turn: Turn) => {
        if (turn.dice.length == 6 && !turn.hasOptions(true))
          return 1500;

        if (turn.isThreePairs())
          return 1000;

        if (turn.isStraight())
          return 1500;
      }
    ))

    Token.ALL = tokens;
    return Token.ALL;
  }
}