import Game, { Game_Event, Game_State } from "../src/Game";
import { Bot_Host } from "./Bot";
import Database from "./Database";

/**
 * Hold history of current game
 */
export class History {
  /**
   * Previous turns
   */
  private turns: History_Turn[] = [];
  /**
   * Current turn
   */
  private turn: History_Turn = null;

  /**
   * Save the current turn if it's valid
   */
  saveTurn() {
    if (this.turn !== null)
      this.turns.push(this.turn)
  }

  /**
   * Save turn and create new
   * @param player 
   * @param score 
   * @param state 
   */
  newTurn(player: string, score: number, state: string) {
    this.saveTurn();
    this.turn = new History_Turn(player, score, state);
  }

  /**
   * Add an event to the history log
   * @param id 
   * @param data 
   */
  addEvent(id: Game_Event, data) {
    this.turn.addEvent(Game_Event[id], data)
  }

  /**
   * Get the turns played
   */
  getTurns(): History_Turn[] {
    return this.turns;
  }
}

/**
 * Reflects a turn in the game with the necessary information for later storage as JSON
 */
class History_Turn {
  private player: number;
  private score: number;
  private state: string;
  private events = []

  constructor(player, score, state) {
    this.player = player;
    this.score = score;
    this.state = state;
  }

  /**
   * Add an event to the turn
   * @param name 
   * @param data 
   */
  addEvent(name, data) {
    this.events.push({ name, data })
  }
}

/**
 * Handle game history
 */
export default class History_Handler {
  /**
   * History for later storage as JSON
   */
  private history: History;
  /**
   * Tokens invoked this roll/bank
   */
  private tokens = [];


  constructor(bot: Bot_Host) {
    // create new history on game creation
    bot.setCallback(Game_Event.GAME, args => {
      this.history = new History;
    })

    // create a new turn on game turn, reset tokens
    bot.setCallback(Game_Event.TURN, args => {
      const game: Game = args.game;
      this.history.newTurn(game.player.id, game.player.score, Game_State[game.state]);
      this.tokens = []
    })

    // push token for later assembly in event
    bot.setCallback(Game_Event.TOKEN, args => {
      this.tokens.push(args.token)
    })

    // add the roll event with the previously collected tokens, reset tokens
    bot.setCallback(Game_Event.ROLL, args => {
      const game = args.game;
      this.history.addEvent(Game_Event.ROLL, {
        dice: game.turn.dice.concat(game.turn.taken),
        tokens: this.tokens,
        points: game.turn.points
      })
      this.tokens = []
    })

    // save the reroll event, reset tokens
    bot.setCallback(Game_Event.REROLL, args => {
      const game = args.game;
      this.history.addEvent(Game_Event.REROLL, {
        dice: game.turn.dice
      })
      this.tokens = []
    })

    // add the bank event with the previously collected tokens, reset tokens
    bot.setCallback(Game_Event.BANK, args => {
      const game = args.game;
      this.history.addEvent(Game_Event.BANK, {
        dice: game.turn.dice.concat(game.turn.taken),
        tokens: this.tokens,
        points: game.turn.points
      })
      this.tokens = []
    })

    // save the zilch event, reset tokens
    bot.setCallback(Game_Event.ZILCH, args => {
      const game: Game = args.game;
      this.history.addEvent(Game_Event.ZILCH, {
        player: game.player.id,
        dice: game.turn.dice,
        points: game.turn.points,
        zilch: game.player.zilch,
        penalty: args.penalty
      })
      this.tokens = []
    });

    // save that a user has been eliminated, reset tokens
    bot.setCallback(Game_Event.ELIMINATED, args => {
      const game: Game = args.game;
      this.history.addEvent(Game_Event.ELIMINATED, {
        player: game.player.id,
        dice: game.turn.dice,
        points: game.turn.points,
      })
      this.tokens = []
    })

    // finally save the current turn and store the history in the database
    bot.setCallback(Game_Event.END, async args => {
      this.history.saveTurn();
      await Database.saveGame(args.game, this.history)
    })
  }
}
