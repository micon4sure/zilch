# Zilch bot for discord

## Rules
see https://en.wikipedia.org/wiki/Dice_10000 for rules.

## Game syntax
| command | effect | arguments | example|
|---------------------------|----------------------|---|-|
| !zilch \| !z  | start a gather @ 10k | join bot| !zilch y
| !rapid \| !r  | start a gather @ 3k  | join bot| !r
| !turbo \| !t  | start a gather @ 500 |join bot | !t y
| !custom \| !c | start a gather @ custom amount | amount ... join bot| !custom 5000 y
| !join \| !j | join a gather
| !goes \| !g | start the game

## Play Syntax
to take single die with face 1 or 5 just type "one" or "five"\
to roll the remaining dice, type "roll", to bank your turn points, type "bank"

example: you have the following dice:\
1 3 6 5 5 2\
you can now roll by typing "one five five roll"

having three of the same face is indicated by adding an "s" to the end:\
1 3 2 3 3 4\
-> "one threes roll"

for 4, add an "es", for 5 an "eses" and for 6 of the same an "eseses"\
1 3 2 3 3 3\
-> "one threeses roll"\
1 3 3 3 3 3\
-> "one threeseses roll"\
3 3 3 3 3 3\
-> "threeseseses roll"

there are shortcuts built in to roll the single dice:\
"onro" is shorthand for "one roll" while "firo" is short for "five roll"

to roll or bank multiple of these, you can use the following shorthand:\
"151r" for "one five one roll"\
"115b" for "one one five bank"

a single `+` will reroll the last token

to try an upgrade to a free do `upgrade` and then the die you want to try to upgrade
for the throw 1 1 2 2 3 4 this could be `upgrade four` or its shorthand `up 4`

## Bot player syntax
| command | effect | arguments | example|
|-|-|-|-|
| ?zilch \| ?z | create a game and join it
| ?rapid \| ?r | create a rapid game and join it
| ?turbo \| ?t | create a turbo game and join it
| ?custom \| ?c | create a custom game and join it | amount | ?custom 5000
| ?join \| ?j | join a gather

## Statistic syntax
Statistics can be requested by !stats, !stat or simply !s, arguments as follow
|command|argument|effect|example|
|-|-|-|-|
| !all | @user | show all statistics for a user| !stat all @mICON
| games | | get statistics about played games| !stat games
| money || get statistics about players' money
| highest|| find the highest score anyone ever got above the limit.

## Configuration
to configure the bot, rename the config.sample.json to config.json
- channels: array of channels bots should to respond to (keep in mind only one game can run at a time)
- admins: array of user ids with privileges
- Bot_Host: discord bot token for the host (game & statistics if enabled)
- Bot_Player discord bot token for the bot player

make sure the bots have the message intent activated.

Enjoy!