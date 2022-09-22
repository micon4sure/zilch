import Database from './Database'
import { Game } from './Game';
let db = new Database();
let game = new Game(() => console.log, '123', 3000);
(async () => {
    let asd = await Database.getGeneralStats("526469115372634122");

    let input = "+++++++";
    let res = input.match(/^(\++)$/)
    console.dir(res)
})();