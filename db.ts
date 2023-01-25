import { aql } from 'arangojs';
import _ from 'lodash'
import Database from './src/Database'
(async () => {

    let result = await Database.getHandle().query(aql`
        FOR doc in Games
            FILTER !doc.bot
            RETURN doc

    `);

    let next;
    while (next = await result.next()) {
        _.each(next.players, player => {
            if(player.bot) console.log(next._id)
            
        })
    }
})()