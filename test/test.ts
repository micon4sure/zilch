const _ = require('lodash')
const { expect } = require('chai')
const {Turn, Parser} = require('../bot.ts')



describe('Turn', () => {
  it("recognises one", () => {
    let turn = new Turn([1, 6, 2, 5, 3, 5]);
    expect(turn.has([1]), true);
    expect(turn.has([1, 1]), false);
  })

  it("takes one", () => {
    let turn = new Turn([1, 6, 2, 5, 3, 5]);
    turn.take([1])
    expect(turn.dice, [6, 2, 5, 3, 5]);
  })

  it("takes oneses", () => {
    let turn = new Turn([1, 6, 1, 1, 4, 5]);
    turn.take([1, 1, 1])
    expect(turn.dice, [6, 4, 5]);
  })
})

describe("Parser", () => {
  it("takes oneses", () => {
    let turn = new Turn([1, 6, 1, 1, 4, 1]);
    let parser = new Parser(turn)
    parser.parse("oneses");
    console.log(turn)
  });
})