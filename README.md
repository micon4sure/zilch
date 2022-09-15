# Zilch bot for discord

## Rules
see https://en.wikipedia.org/wiki/Dice_10000 for rules.

## Syntax
to take single dice 1 or 5 just type "one" or "five"\
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
-> "threeseseses roll"\

there are shortcuts built in to roll the single dice:\
"onro" is shorthand for "one roll" while "firo" is short for "five roll"

to roll or bank multiple of these, you can use the following shorthand:\
"151r" for "one five one roll"\
"115b" for "one one five bank"

## configuration
to configure the bot, create a config.json file in the root directory with the following structure:\
{\
    "channel": "discord channel id to join",\
    "admin": "discord user id",\
    "token": "discord bot auth token"\
}\
make sure the bot has the message intent activated.


Enjoy!