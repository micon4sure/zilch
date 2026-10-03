# Zilch Discord bot

A Discord bot for playing the Zilch/Farkle dice game. General rules are available at [Wikipedia](https://en.wikipedia.org/wiki/Dice_10000).

## Commands

| Command | Effect |
| --- | --- |
| `!zilch [y]`, `!z [y]` | Open a lobby with a 10,000-point limit. |
| `!rapid [y]`, `!r [y]` | Open a lobby with a 3,000-point limit. |
| `!turbo [y]`, `!t [y]` | Open a lobby with a 500-point limit. |
| `!custom <limit> [y]`, `!c <limit> [y]` | Open a lobby with a custom positive point limit. |
| `!join`, `!j` | Join the open lobby. |
| `!goes`, `!g` | Start the open lobby. |
| `!help`, `!h`, `!commands` | Show the command overview. |
| `!howto`, `!how`, `!rules` | Explain scoring input, shortcuts, and upgrades. |
| `!reset` | Abandon the current game. This is restricted to configured admins and bots. |

The lobby creator joins automatically. Add `y` to a start command, such as `!rapid y` or `!custom 5000 y`, to ask the configured bot player to join.

Commands are case-insensitive and may contain extra spaces.

## How to play

On your turn, the bot shows the available dice. Select one or more scoring dice and finish the same message with `roll` to continue or `bank` to keep the points. You need at least 300 points in the current turn before you can bank.

Single scoring dice:

- `one` takes a 1 for 100 points.
- `five` takes a 5 for 50 points.

Sets of three use the plural face name: `ones`, `twos`, `threes`, `fours`, `fives`, or `sixes`. Add `es`, `eses`, or `eseses` for four, five, or six of a kind. For example:

- `threes` takes three 3s.
- `threeses` takes four 3s.
- `threeseses` takes five 3s.
- `threeseseses` takes six 3s.

Examples:

```text
one five five roll
threes bank
```

Shortcuts:

- `onro` means `one roll`.
- `firo` means `five roll`.
- `151r` means `one five one roll`.
- `115b` means `one one five bank`.
- `+` repeats the scoring dice from the previous roll and rolls again.
- `roll?` randomly chooses between rolling and banking.

Use `free` for a straight, three pairs, or a fresh six-die roll with no scoring dice. It scores the combination and rolls a new set.

Once per fresh set of six dice, `upgrade <die>` or `up <die>` rerolls one selected die when changing it could create a free combination. For example:

```text
up 5
upgrade four
```

## Bot player commands

The optional bot player listens for these commands:

| Command | Effect |
| --- | --- |
| `?zilch`, `?z` | Open a 10,000-point lobby. |
| `?rapid`, `?r` | Open a 3,000-point lobby. |
| `?turbo`, `?t` | Open a 500-point lobby. |
| `?custom <limit>`, `?c <limit>` | Open a lobby with a custom limit. |
| `?join`, `?j` | Join the open lobby. |

## Configuration

Copy `config.sample.jsonc` to `config.jsonc`, then configure:

- `channels`: Discord channel IDs in which the host bot may respond. Only one game can run at a time.
- `admins`: Discord user IDs allowed to reset a game.
- `Bot_Host`: Discord token for the host bot.
- `Bot_Player`: optional Discord token for the bot player. Remove this property or leave it empty to disable the player bot.
- `alert_zilch`: emphasize consecutive Zilch alerts.
- `alert_ending`: emphasize rolls during the final round.
- `timeout_gather`: lobby timeout in milliseconds.
- `timeout_turn`: turn timeout in milliseconds.

Enable the Message Content intent for both Discord applications.

## Development

Install dependencies and validate the TypeScript source:

```bash
bun install
bun x tsc --noEmit --incremental false
```

Run directly from TypeScript:

```bash
bun run zilch
```

Create the standalone Bun bundle used by the container:

```bash
bun build --target=bun bots.ts --outfile zilch.js
```
