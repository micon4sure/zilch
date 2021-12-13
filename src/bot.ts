import _ from 'lodash'
import { Client, Intents, MessageEmbed } from 'discord.js'

import { Game, Turn, State, Player } from './Game'
import convertDiceToSVG from './convert'
import Sender from './Sender'
//TODO repurpose instance, don't create new on !start
let game = new Game(null, null, 0);

const CHANNEL = "915147813761978398"
const auth = require('../auth.json');

const bot = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });
bot.login(auth.token)
bot.on('ready', function (evt) {
  console.log(`Connected and logged in.`);
});

bot.on('messageCreate', async message => {
  let { channelId, author, content } = message;
  if (channelId != CHANNEL) {
    return;
  }
  if (content.substring(0, 1) == '!') {
    let chunks = content.split(" ");
    let command = chunks[0].substring(1, chunks[0].length);

    let sender = new Sender((text) => {
      message.channel.send(text)
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
        send("goes!")
        game = new Game(send, author.id, 500);
        game.gather();
        game.join(new Player("526469115372634122", "mICON"))
        game.join(new Player("866599161868320779", "satellite"))
        game.start();
        break;
      case "start":
        handle(
          () => {
            game = new Game(send, author.id, 10000);
            game.gather();
            game.join(new Player(author.id, author.username))
            send("started. !join up")
          },
          () => send("round already started, `!join` up."),
          () => send("game is running.")
        )
        break;
      case "reset":
        if (author.id != "526469115372634122") return;
        game.state = State.IDLE;
        break;
      case "rapid":
        handle(
          () => {
            game = new Game(send, author.id, 3000);
            game.gather();
            game.join(new Player(author.id, author.username))
            send("rapid started: 3000. `!join` up")
          },
          () => send("round started, `!join` up"),
          () => send("game is running")
        )
        break;
      case "custom":
        handle(
          () => {
            game = new Game(send, author.id, parseInt(chunks[1]));
            game.gather();
            game.join(new Player(author.id, author.username))
            send(`started: ${chunks[1]}. \`!join\` up`);
          },
          () => send("round started, `!join` up"),
          () => send("game is running")
        )
        break;
      case "join":
        handle(
          () => send("no game running. go `!start`"),
          () => {
            game.join(new Player(author.id, author.username));
            send("joined.")
          },
          () => send("game is running.")

        )
        break;
      case "goes":
        handle(
          () => send("no gather active. Go `!start`"),
          () => {
            if (game.startedBy != author.id) return send("only round starter can `!goes`")
            game.start();
            send("goes.")
          },
          () => send("game already running.")
        )
        break;
    }
  }

  // if message is by current player, send to game to be parsed
  if (game.isActivePlayer(author.id)) {
    game.input(content);
  }
});