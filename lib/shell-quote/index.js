exports.quote = function(xs) {
  return xs.map(function(s) {
    if (typeof s === 'object') return s.op;
    return String(s).replace(/([\s\\"'$`!#&*(){}\[\]<>;])/g, '\\$1');
  }).join(' ');
};
exports.parse = function(s, env) {
  var chunker = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
  var match, arr = [];
  while ((match = chunker.exec(s)) !== null) {
    arr.push(match[1] !== undefined ? match[1] : match[2] !== undefined ? match[2] : match[0]);
  }
  return arr;
};
