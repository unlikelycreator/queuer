// Avatar colours used when a user is created — tuned to sit well on the green theme.
const AVATAR_COLORS = ['#10b981', '#0d9488', '#059669', '#65a30d', '#0891b2', '#d97706', '#e11d48', '#7c3aed'];

function randomColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

module.exports = { AVATAR_COLORS, randomColor };
