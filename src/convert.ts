import _ from 'lodash'
const { MessageAttachment } = require('discord.js')
const svg2png = require('svg2png')

const mapDieFace = (die) => {
  switch (die) {
    case 1:
      return "⚀";
    case 2:
      return "⚁";
    case 3:
      return "⚂";
    case 4:
      return "⚃";
    case 5:
      return "⚄";
    case 6:
      return "⚅";
  }
}

export default function convertDiceToSVG(dice: number[]) {
  let emoji = dice.map(mapDieFace).join(" ");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="350" height="42">
                <g id="template">
                  <rect id="background" width="350" height="42" transform="translate(208 209)" fill="#232323"/>
                  <text id="dice" transform="translate(0 42)" fill="#fff" font-size="42" font-family="Consolas, Segoe UI"><tspan x="0" y="0">${emoji}</tspan></text>
                </g>
              </svg>`;
  const buffer = svg2png.sync(Buffer.from(svg, "utf-8"))
  return buffer;
}