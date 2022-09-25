import _ from 'lodash'
import Game, { Game_CallbackHandler, Game_Event } from "./Game";
import Token from "./Token";

/**
 * Represents a turn in the game. Turn ends on bank or zilch
 */
export default class Turn {
  /**
   * Callback handler for events
   */
  callbackHandler: Game_CallbackHandler;
  /**
   * The dice the player has to act on
   */
  dice: number[];
  /**
   * The points gathered this turn
   */
  points: number;
  /**
   * The dice taken off the table in the latest roll
   */
  taken: number[] = [];

  constructor(callbackHandler: Game_CallbackHandler, dice: number[]) {
    this.callbackHandler = callbackHandler;
    this.dice = dice;
    this.points = 0;
  }

  /**
   * Invoke a token
   * @param token 
   */
  invoke(token: string): void {
    _.each(Token.getAll(), (candidate: Token) => {
      if (candidate.token != token)
        return;
      if (!candidate.validate(this))
        return;
      this.callbackHandler.activateCallbacks(Game_Event.TOKEN, { token });
      candidate.invoke(this);
    });
  }

  /**
   * Check if the requested dice are available
   * @param dice 
   */
  has(dice: number[]): boolean {
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

  /**
   * Take certain dice off the table
   * @param dice 
   */
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
          // return false : break each
          return false;
        }
        return null;
      });
    });
    this.taken = this.taken.concat(_.map(exclude, idx => this.dice[idx]));
    this.dice = _.filter(this.dice, (die, index) => !_.includes(exclude, index));
  }

  /**
   * Check if three paris are present
   */
  isThreePairs(): boolean {
    if (this.dice.length < 6)
      return false;
    let dice = _.clone(this.dice);


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

  /**
   * Check if dice form a straight (1 - 6)
   */
  isStraight(): boolean {
    return _.uniq(this.dice).length == 6;
  }

  /**
   * Check if user has options left
   * @param skipFree 
   */
  hasOptions(skipFree = false): boolean {
    let options = false;
    _.each(Token.getAll(), token => {
      if (skipFree && token.token == "free") {
        return;
      }
      if (token.validate(this)) {
        options = true;
        // return false : break each
        return false;
      }
    });
    return options;
  }

}