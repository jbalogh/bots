var https = require('https'),
    sys = require('sys');


function GET(options, cb) {
    https.get(options, function(r) {
        var body = '';
        r.on('data', function(d){ body += d; });
        r.on('end', function() {
            cb(r, body);
        });
    });
}


var branchesURL = '/api/v2/json/repos/show/jbalogh/zamboni/branches';

exports.checkRev = function(cb) {
    GET({host: 'github.com', path: branchesURL}, function(r, body) {
        var ghRev = JSON.parse(body).branches.master, amoRev;
        sys.puts(ghRev);
        GET({host: 'addons.allizom.org', path: '/media/git-rev.txt'}, function(r, body) {
            amoRev = body;
            sys.puts(amoRev);
            cb(amoRev, ghRev);
        });
    });
};
