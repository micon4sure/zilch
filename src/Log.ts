import { Game, Player } from "./Game";
import _ from 'lodash'

class Log_Turn {
    player: string;
    actions: Log_Action[] = [];
    score: number;
}
class Log_Action {
    type: string;
    points: number;
    score: number;
    tokens: [];
    dicePre: [];
    diceTaken: [];
    dicePost: [];
    zilch: boolean;

    public constructor( tokens, type, points, score, dice, taken, zilch) {
        this.tokens = tokens;
        this.type = type;
        this.points = points;
        this.score = score;
        this.dicePre = dice.concat(taken);
        this.diceTaken = taken;
        this.dicePost = dice;
        this.zilch = zilch;
    }
}

export default class Log {

    private tokens = [];

    private static instance: Log = null;

    private game: Game;
    private turn: Log_Turn = null;
    private turns: Log_Turn[] = [];

    public constructor(game: Game) {
        this.game = game;
    }

    public static get(): Log {
        if (Log.instance === null)  {
            throw new Error('No log instance initialized. Do it at game start.');
        }
        return Log.instance;
    }

    public static startGame(game: Game) {
        Log.instance = new Log(game);
    }
    public static endGame() {
    }

    public invokingToken(token: string) {
        this.tokens.push(token);
    }
    
    public roll(points, score, dice, taken, zilch) {
        this.turn.actions.push(new Log_Action(this.tokens, "roll", points, score, dice, taken, zilch));
        this.tokens = [];
    }
    public bank(points, score, dice, taken) {
        this.turn.actions.push(new Log_Action(this.tokens, "bank", points, score, dice, taken, false));
        this.turns.push(this.turn);
        this.tokens = [];
    }
    public zilch() {
        this.turns.push(this.turn);
    }

    public getGameStats(winner: Player) {
        return {
            turns: this.turns,
            game: {
                debug: this.game.debug,
                limit: this.game.limit,
                startedBy: this.game.startedBy
            },
            winner: {
                id: winner.id,
                name: winner.name,
                score: winner.score
            },
            players: _.map(this.game.players, player => {
                return {
                    score: player.score,
                    id: player.id,
                    name: player.name,
                    eliminated: player.eliminated
                }
            })
        }
    }

    public getPreviousTokens(steps) {
        let position = this.turn.actions.length -steps;
        console.log("pos ", position)
        let action = this.turn.actions[position]
        console.log("action ", action)
        return action.tokens;
    }

    public startTurn(player: string) {
        this.turn = new Log_Turn();
        this.turn.player = player;
    }
}