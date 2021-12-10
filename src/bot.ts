import _ from 'lodash'
import { Game, Turn, State, Player } from './Game'
import Sender from './Sender'

const CHANNEL = "915147813761978398"
const Discord = require('discord.io');
const auth = require('../auth.json');
let bot = new Discord.Client({
  token: auth.token,
  autorun: true
});

// DUMMY BOT
// let bot = {
//   on(evt: any, callback: any)  {},
//   sendMessage(msg) {},
//   username: String,
//   id: String
// }

bot.on('ready', function (evt) {
  console.log(`Connected and logged in as ${bot.username}`);
});

//TODO repurpose instance, don't create new on !start
let game = new Game(null, null, 0);

bot.on('message', function (user, userID, channelID, message, evt) {
  // bot.sendMessage({to: CHANNEL, message: "asd"})
  if (channelID != CHANNEL) {
    return;
  }
  if (message.substring(0, 1) == '!') {
    let chunks = message.split(" ");
    let command = chunks[0].substring(1, chunks[0].length);

    let sender = new Sender((message) => {
      bot.sendMessage({ to: CHANNEL, message })
    });
    let send = sender.send.bind(sender);
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
      case "test":
        let sendClosure = (message) => {
          send(message);
        }
        send("goes!")
        game = new Game(sendClosure, userID, 500);
        game.gather();
        game.join(new Player("526469115372634122", "mICON"))
        game.join(new Player("866599161868320779", "satellite"))
        game.start();
        break;
      case "start":
        handle(
          () => {
            let sendClosure = (message) => {
              send(message);
            }
            game = new Game(sendClosure, userID, 10000);
            game.gather();
            game.join(new Player(userID, user))
            send("game started. _!join_ up everyone..")
          },
          () => send("round has already been started, just !join up."),
          () => send("game is running, shut up for a second.")
        )
        break;
      case "!reset":
          if (userID != "526469115372634122") return;
          game.state = State.IDLE;
        break;
      case "rapid":
        handle(
          () => {
            let sendClosure = (message) => {
              send(message);
            }
            game = new Game(sendClosure, userID, 1000);
            game.gather();
            game.join(new Player(userID, user))
            send("rapid game started. Limit 1000. Let's go, _!join_ up everyone..")
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
  if (game.isActivePlayer(userID)) {
    game.input(message);
  }
});