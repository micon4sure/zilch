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

class Die {
  face: Number
  text: String
  value: Number

  constructor(face: Number, text: String, value: Number) {
    this.face = face;
    this.text = text;
    this.value = value;
  }
}

class Parser {
  values: Die[]

  constructor() {
    this.values.push(new Die(1, "ones", 1000));
    _.each({2: "twos", 3: "threes", 4: "fours", 5: "fives"}, (text, num) => {
      this.values.push(new Die(num, text, num * 100));
    })
    this.values.push(new Die(6, "sixes", 600));
  }

  parse(input) {
    // parse input for tokens like oneses five

    // check if dice actually deliver those

    // return point value
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

class Turn {
  player: Player
  dice: any
}

class Game {
  send: Function
  state: State
  players: Player[]
  startedBy: String
  currentTurn: Turn

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
    this.turn();
    let dice = this.roll(6)
    this.send(dice)
  }

  turn() {
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

game = new Game((msg) => console.log(msg), 1);
game.join(new Player(1, "mICON"));
game.start();

game.currentTurn = new Turn();
  game.currentTurn.dice = [3, 3, 4, 5, 3, 1]

// TODO
//game.input('one five roll')