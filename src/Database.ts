import _ from 'lodash'
import Game from './Game'
import Config, { Config_Param } from './Config'
import { History } from './History'
import { aql } from 'arangojs';
import { dataToBase64 } from 'svg-png-converter';

let Arango = require('arangojs').Database;

/**
 * Arango database wrapper
 */
export default class Database {

  /**
   * Save a completed game
   * @param game Game
   * @param history History
   * @returns 
   */
  public static async saveGame(game: Game, history: History) {
    let doc = {
      date: Date.now(),
      bot: game.bot,
      limit: game.limit,
      startedBy: game.startedBy,
      players: game.players,
      ender: game.ender,
      winner: game.winner,
      history: history.getTurns()
    }
    return await Database.getHandle().collection('Games').save(doc);
  }

  /**
   * Get a handle to the database
   */
  public static getHandle() {
    const db = new Arango('http://localhost:8529');
    db.useDatabase('Zilch');
    let [user, pw] = [Config.getParam(Config_Param.DB_USER), Config.getParam(Config_Param.DB_PASSWORD)]
    db.useBasicAuth(user, pw);
    return db;
  }

  private static async getLastKnownPlayerName(id) {
    const db = Database.getHandle();
    const query = aql`
        FOR doc in Games
            SORT doc.date DESC
            FILTER ${id} IN doc.players[*].id
            return doc.players
        `
    const result = await db.query(query)
    const players = await result.next()
    if (players === undefined)
      throw new Error("Can't find game with player id " + id);
    let name;
    _.each(players, player => {
      if (player.id == id) {
        name = player.name;
        return false;
      }
    })
    if (name === undefined)
      throw new Error("Can't find name for player with id " + id);
    return name
  }

  /**
   * Get money stats for all players
   */
  public static async getMoneyStats() {
    const db = Database.getHandle();
    try {
      const query = aql`
            FOR doc in Games
                FILTER (!doc.bot && doc.players > 1) || (doc.bot && LENGTH(doc.players) > 2)
                COLLECT
                  winner = doc.winner.id,
                  score = doc.players[* FILTER CURRENT.id == doc.winner.id].score
                    WITH COUNT INTO amount
                SORT score DESC
                RETURN {id: winner, score: amount * score}
            `;
      let result, next;
      let amounts = {}

      result = await db.query(query);
      
      // sum up the amounts returned by the dataqbase
      while (next = await result.next()) {
        if (next.id === null)
          continue;
        if (amounts[next.id] === undefined)
          amounts[next.id] = 0;
        amounts[next.id] += next.score;
      }
      
      // create an array of objects with id and score by mapping over the sums
      let mapped = _.map(amounts, (score, id) => { return { id, score } });
      // sort the array by score, reverse it so as to be sorted DESC
      let sorted = _.slice(_.reverse(_.sortBy(mapped, ['score'])), 0, 5)
      // read the last known name for each of these players and add it to the result
      await Promise.all(_.map(sorted, async (stat, idx) => {
        sorted[idx].name = await Database.getLastKnownPlayerName(stat.id)
      }))
      return sorted;

    } catch (err) {
      console.log(err)
      console.error(err.response.body)
    }

  }

  /**
   * Get statistics for played games
   */
  public static async getGameStats() {
    const db = Database.getHandle();
    try {
      const query = aql`
            let games = LENGTH(
                FOR doc in Games
                FILTER (!doc.bot && doc.players > 1) || (doc.bot && LENGTH(doc.players) > 2)
                RETURN 1
            )
            let starterWin = LENGTH(
                FOR doc IN Games
                FILTER (!doc.bot && doc.players > 1) || (doc.bot && LENGTH(doc.players) > 2)
                FILTER LENGTH(doc.startedBy == doc.winner.id)
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

  /**
   * Get all possible statistics for a player
   * @param id string
   */
  public static async getGeneralStats(id: string) {
    const db = Database.getHandle();
    try {
      const query = aql`
            LET games = LENGTH(
                FOR doc in Games
                FILTER (!doc.bot && doc.players > 1) || (doc.bot && LENGTH(doc.players) > 2)
                FILTER LENGTH(doc.players[* FILTER CURRENT.id == ${id}]) == 1
                return doc
            )
            LET wins = LENGTH(
                FOR doc IN Games
                FILTER (!doc.bot && doc.players > 1) || (doc.bot && LENGTH(doc.players) > 2)
                FILTER doc.winner.id == ${id}
                    return doc
            )
            LET winnings = SUM(
                FOR doc IN Games
                FILTER (!doc.bot && doc.players > 1) || (doc.bot && LENGTH(doc.players) > 2)
                FILTER doc.winner.id == ${id}
                    return SUM(doc.players[* FILTER CURRENT.id == ${id}].score)
            )
            LET started = LENGTH(
                FOR doc IN Games
                FILTER LENGTH(doc.players) > 1 || doc.bot && LENGTH(doc.players) > 2
                    FILTER doc.startedBy == ${id}
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

  /**
   * Get the highest score over the limit of the game
   */
  public static async getHighest() {
    const db = Database.getHandle();
    try {
      const query = aql`
            FOR doc IN Games
            FILTER (!doc.bot && doc.players > 1) || (doc.bot && LENGTH(doc.players) > 2)
            LET over = doc.winner.score - doc.\`limit\`
                SORT over DESC
                RETURN { over, \`limit\`: doc.\`limit\`, date: doc.date, player: doc.winner.name }
        `;
      const result = await db.query(query);
      return await result.next();
    } catch (err) {
      //console.log(err)
      console.error(err.response.body)
    }

  }
}