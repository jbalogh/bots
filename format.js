/* Python(ish) string formatting:
 * >>> format('{0}', ['zzz'])
 * "zzz"
 * >>> format('{0}{1}', 1, 2)
 * "12"
 * >>> format('{x}', {x: 1})
 * "1"
 */
exports.format = (function() {
    var re = /\{([^}]+)\}/g;
    return function(s, args) {
        if (!args) return;
        if (!(args instanceof Array || args instanceof Object))
            args = Array.prototype.slice.call(arguments, 1);
        return s.replace(re, function(_, match){ return args[match]; });
    };
})();

exports.template = function(s) {
    return function(args) { return format(s, args); };
}
