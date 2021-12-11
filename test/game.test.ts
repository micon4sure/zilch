const _ = require('lodash')

import { describe, expect, it } from '@jest/globals'


import Action from '../src/Action'
import { Game, Turn, Player } from '../src/Game'

describe("Game", () => {
  it("starts", () => {
    let game = new Game((msg) => console.log(msg), "1", 500);
    game.gather();
    game.join(new Player("1", "mICON"));
    game.join(new Player("2", "satellite"))
    game.start();

    game.turn.dice = [1, 1, 3, 5, 2, 1];
    console.log(game.turn.dice)

    game.input("ones roll");
    console.log(game.turn.dice)
  })
})

describe("Action", () => {
  it("knows three pairs", () => {
    expect(new Action(new Turn([1, 2, 3, 4, 5, 6]), () => {}).isThreePairs()).toBe(false)

    expect(new Action(new Turn([2, 2, 3, 3, 4, 4]), () => {}).isThreePairs()).toBe(true)
    expect(new Action(new Turn([2, 3, 3, 2, 4, 4]), () => {}).isThreePairs()).toBe(true)
    expect(new Action(new Turn([2, 4, 2, 4, 6, 6]), () => {}).isThreePairs()).toBe(true)
  });

  it("knows straight", () => {
    expect(new Action(new Turn([6, 1, 3, 2, 5, 4]), () => {}).isStraight()).toBe(true)

    expect(new Action(new Turn([6, 2, 3, 2, 5, 4]), () => {}).isStraight()).toBe(false)
  });
});