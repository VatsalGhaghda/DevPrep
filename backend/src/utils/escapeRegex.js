/** Escape user input so it can be used literally inside a RegExp / $regex. */
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { escapeRegex };
