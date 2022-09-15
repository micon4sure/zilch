import _ from 'lodash'
import { Client, Intents, MessageEmbed } from 'discord.js'

import { Game, Turn, State, Player } from './Game'
import convertDiceToSVG from './convert'
import Sender from './Sender'
import { exitOnError } from 'winston'
//TODO repurpose instance, don't create new on !start
let game = new Game(null, null, 0);
let config
try {
  config = require('../config.json');
} catch (err) {
  console.log('config file not found, should be in format ' + JSON.stringify({
    "channel": "discord channel id",
    "admin": "discord user id",
    "token": "discord bot auth token"
  }));
  process.exit()
}

const bot = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });
bot.login(config.token)
bot.on('ready', function (evt) {
  console.log(`Connected and logged in.`);
  //const channel = bot.channels.cache.get(config.channel) as any
  //channel.send("connected afresh.")
});

bot.on('messageCreate', async message => {
  let { channelId, author, content } = message;
  if (channelId != config.channel) {
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
        if (author.id != config.admin) return;
        game.state = State.IDLE;
        send("done.")
        break;
      case "rapid":
      case "turbo":
        handle(
          () => {
            game = new Game(send, author.id, 3000);
            game.gather();
            game.join(new Player(author.id, author.username))
            send("rapid started: $3000. `!join` up")
          },
          () => send("round already started, `!join` up"),
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
            if (game.startedBy != author.id) {
              game.join(new Player(author.id, author.username));
            }
            game.start();
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