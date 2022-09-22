import _ from 'lodash'
import { Game } from './Game'
import Config from './Config'
import { aql } from 'arangojs';
import Log from './Log';

let Arango = require('arangojs').Database;

export default class Database {
    public static startGame() {

    }

    public static saveGame(stats) {
        let doc = {
            date: Date.now(),
            ...stats
        }
        Database.getHandle().collection('Games').save(doc);
    }

    private static getHandle() {
        const db = new Arango('http://localhost:8529');
        db.useDatabase('Zilch');
        let [user, pw] = [Config.getParam('database_user'), Config.getParam('database_password')]
        db.useBasicAuth(user, pw);
        return db;
    }

    public static async getMoneyStats() {
        const db = Database.getHandle();
        try {
            const query = aql`
            FOR doc in Games
                FILTER LENGTH(doc.players) > 1
                COLLECT winner = doc.winner.id, score = doc.players[* FILTER CURRENT.id == doc.winner.id].score
                WITH COUNT INTO amount
                return {id: winner, score: amount * score}
            `;
            const result = await db.query(query);
            let amounts = {}
            let next;
            while (next = await result.next()) {
                if (typeof amounts[next.id] === "undefined")
                    amounts[next.id] = 0;
                amounts[next.id] += next.score;
            }
            let mapped = _.map(amounts, (score, id) => { return { id, score } });
            return _.slice(_.reverse(_.sortBy(mapped, ['score']), 0, 2))
        } catch (err) {
            console.log(err)
            console.error(err.response.body)
        }

    }
    public static async getGameStats() {
        const db = Database.getHandle();
        try {
            const query = aql`
            let games = LENGTH(FOR doc in Games FILTER LENGTH(doc.players) > 1 RETURN 1)
            let starterWin = LENGTH(
                FOR doc IN Games
                    FILTER LENGTH(doc.players) > 1
                    FILTER LENGTH(doc.game.startedBy == doc.winner.id)
                    return 1
            )
            return {games, starterWin}
        `;
            const result = await db.query(query);
            return await result.next();
        } catch (err) {
            console.log(err)
            console.error(err.response.body)
        }
    }

    public static async getGeneralStats(id: string) {
        const db = Database.getHandle();
        try {
            const query = aql`
            LET games = LENGTH(
                FOR doc in Games
                FILTER LENGTH(doc.players) > 1
                FILTER LENGTH(doc.players[* FILTER CURRENT.id == ${id}]) == 1
                return doc
            )
            LET wins = LENGTH(
                FOR doc IN Games
                    FILTER LENGTH(doc.players) > 1
                    FILTER doc.winner.id == ${id}
                    return doc
            )
            LET winnings = SUM(
                FOR doc IN Games
                    FILTER LENGTH(doc.players) > 1
                    FILTER doc.winner.id == ${id}
                    return SUM(doc.players[* FILTER CURRENT.id == ${id}].score)
            )
            LET started = LENGTH(
                FOR doc IN Games
                    FILTER LENGTH(doc.players) > 1
                    FILTER doc.game.startedBy == ${id}
                    return doc
            )
            return {games, wins, winnings, started}`;
            const result = await db.query(query);
            return await result.next();

        } catch (err) {
            console.log(err)
            console.error(err.response.body)
        }
    }

    public static async getHighest() {
        const db = Database.getHandle();
        try {
            const query = aql`
            FOR doc IN Games
                LET over = doc.winner.score - doc.game.\`limit\`
                SORT over DESC
                RETURN { over, \`limit\`: doc.game.\`limit\`, date: doc.date, player: doc.winner.name }
        `;
            const result = await db.query(query);
            return await result.next();
        } catch (err) {
            //console.log(err)
            console.error(err.response.body)
        }

    }
}