const CHANNEL = "915147813761978398"

enum State {
  IDLE, GATHER, RUNNING
}

let _ = require('lodash')

var Discord = require('discord.io');
var logger = require('winston');
var auth = require('./auth.json');
// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
  colorize: true
});
logger.level = 'debug';
// Initialize Discord Bot
// var bot = new Discord.Client({
//   token: auth.token,
//   autorun: true
// });
let bot = {
  on(evt: any, callback: any)  {},
  sendMessage(msg) {},
  username: String,
  id: String
}
bot.on('ready', function (evt) {
  logger.info('Connected');
  logger.info('Logged in as: ');
  logger.info(bot.username + ' - (' + bot.id + ')');
});


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

export class Token {
  token: String
  value: Number
  dice: Number[]
  constructor(token: String, value: Number, dice: Number[]) {
    this.token = token;
    this.value = value;
    this.dice = dice;
  }
}

//TODO: rename
export class Parser {
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

  parse(text: String, roll: Function, bank: Function) {
    // split text by spaces
    let tokens = text.split(" ");

    let doRoll = false;
    let doBank = false;

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
          }
        }
      });

      if (token == "roll") doRoll = true;
      else if (token == "bank") doBank = true;;
    })

    if (doRoll) roll();
    else if (doBank) bank();
  }
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

let game = new Game(null, null);

bot.on('message', function (user, userID, channelID, message, evt) {
  // bot.sendMessage({to: CHANNEL, message: "asd"})
  if (channelID != CHANNEL) {
    return;
  }
  if (message.substring(0, 1) == '!') {
    let chunks = message.split(" ");
    let command = chunks[0].substring(1, chunks[0].length);

    let send = (message) => {
      bot.sendMessage({ to: CHANNEL, message })
    }
    let handle = (idle, gather, running) => {
      if (game.state == State.IDLE && idle !== null) {
        idle();
      }
      else if (game.state == State.GATHER && gather !== null) {
        gather();
      }
      else if (game.state == State.RUNNING && running !== null) {
        running();
      }
    };
    switch (command) {
      case "start":
        handle(
          () => {
            let sendClosure = (message) => {
              send(message);
            }
            game = new Game(sendClosure, userID);
            game.gather();
            game.join(new Player(userID, user))
            send("game started. _!join_ up everyone..")
          },
          () => send("round has already been started, just !join up."),
          () => send("game is running, shut up for a second.")
        )
        break;
      case "join":
        handle(
          () => send("no game running to start. Type !start if you want to begin a new one."),
          () => {
            game.join(new Player(userID, user));
            send("ok, joined.")
          },
          () => send("game is running, shut up for a second.")

        )
        break;
      case "goes":
        handle(
          () => send("no gather active to start. Type !start if you want to start a gather"),
          () => {
            if (game.startedBy != userID) return send("only round starter can begin the game")
            game.start();
            send("goes.")
          },
          () => send("game is already running, fool!")
        )
        break;
    }
  }

  // if message is by current player, send to game to be parsed
});

export default {
  Turn, Game, Player, Parser
}