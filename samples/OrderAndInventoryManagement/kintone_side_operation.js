'use strict';

// Libraries
var https = require('https'); // HTTPS request
var querystring = require('querystring');

// constant parameters
const KINTONE_HOST = 'ev6.cybozu.com';
const APP_ID = 337; // レンタル貸出管理
const MASTER_APP_ID = 338; // レンタル備品マスタ
const AUTH_TOKEN = (new Buffer('alexa:reInvent2016')).toString('base64');
const BASIC_TOKEN = (new Buffer('njKUS6eW69zrH3Lj:y-Vijrb-hQwouodQ')).toString('base64');

// get options to access to kintone REST API
function getOptions(path, method) {
  return {
    hostname: KINTONE_HOST,
    port: 443,
    path: path,
    method: method,
    headers: {
      'X-Cybozu-Authorization': AUTH_TOKEN,
      'Authorization': 'Basic ' + BASIC_TOKEN
    }
  };
}

// update kintone records
var putRecords = function(appId, records, callback, errback, data) {
  if (!errback) {
    errback = function(err) {};
  }
  if (!data) {
    var data = {
      records: []
    };
  }
  var putRecordsPerOnce = 100;

  var params = {
    app: appId,
    records: records.slice(0, Math.min(putRecordsPerOnce, records.length))
  };

  var json = JSON.stringify(params);
  // set request headers
  var options = getOptions('/k/v1/records.json', 'PUT');
  options.headers['Content-Type'] = 'application/json';

  var req = https.request(options, function(res) {
    var body = '';
    res.setEncoding('utf8');
    res.on('data', function(chunk) {
      if (res.statusCode === 200) {
        body += chunk;
      }
    });
    res.on('end', function() {
      var resp = JSON.parse(body);
      //console.log(body);
      data.records = data.records.concat(resp.records);
      if (records.length > putRecordsPerOnce) {
        putRecords(appId, records.slice(putRecordsPerOnce), callback, errback, data);
      } else {
        callback(data);
      }
    });
  });

  req.on('error', function(e) {
    console.log('problem with request: ' + e.message);
    errback(e.message);
  });

  req.write(json);
  req.end();

}

// regist kintone records
var postRecords = function(appId, records, callback, errback, data) {
  if (!errback) {
    errback = function(err) {};
  }
  if (!data) {
    var data = {
      records: []
    };
  }
  var putRecordsPerOnce = 100;

  var params = {
    app: appId,
    records: records.slice(0, Math.min(putRecordsPerOnce, records.length))
  };

  var json = JSON.stringify(params);
  // set request headers
  var options = getOptions('/k/v1/records.json', 'POST');
  options.headers['Content-Type'] = 'application/json';

  var req = https.request(options, function(res) {
    var body = '';
    res.setEncoding('utf8');
    res.on('data', function(chunk) {
      if (res.statusCode === 200) {
        body += chunk;
      }
    });
    res.on('end', function() {
      var resp = JSON.parse(body);
      //console.log(body);
      data.records = data.records.concat(resp.records);
      if (records.length > putRecordsPerOnce) {
        putRecords(appId, records.slice(putRecordsPerOnce), callback, errback, data);
      } else {
        callback(data);
      }
    });
  });

  req.on('error', function(e) {
    console.log('problem with request: ' + e.message);
    errback(e.message);
  });

  req.write(json);
  req.end();

}

// get kintone records
function getRecords(appId, condition, lmt, ofs, fields, callback, errback, data) {
  var limit_num = (lmt === undefined) ? 500 : lmt;
  var limit = ' limit ' + limit_num;
  var offset = (ofs === undefined) ? '' : ' offset ' + ofs;

  if (!Array.isArray(fields)) {
    fields = [];
    data = callback;
    callback = fields;
  }

  var query = condition + limit + offset;

  if (!data) {
    var data = {
      records: []
    };
  }

  var params = {
    app: appId,
    query: query
  };
  if (fields.length > 0) {
    params.fields = fields;
  }

  var query = querystring.stringify(params);
  var options = getOptions('/k/v1/records.json?' + query, 'GET');
  var req = https.request(options, function(res) {
    var body = '';
    res.setEncoding('utf8');
    res.on('data', function(chunk) {
      if (res.statusCode === 200) {
        body += chunk;
      }
    });
    res.on('end', function() {
      //console.log(body);
      var resp = JSON.parse(body);
      data.records = data.records.concat(resp.records);
      if (resp.records.length < limit_num || limit_num == 1) {
        callback(data);
      } else {
        ofs = parseInt(ofs) + resp.records.length;
        getRecords(appId, condition, limit_num, ofs, fields, callback, errback, data);
      }
    });
  });

  req.on('error', function(e) {
    console.log('problem with request: ' + e.message);
    errback(e.message);
  });
  req.end();
}

exports.handler = (event, context, callback) => {
  var type = event.type;
  var rent_rec;
  new Promise(function(resolve, reject) {
    var condition = 'type in ("' + type + '") and status not in ("rented") ';
    getRecords(MASTER_APP_ID, condition, 500, 0, ['$id'], function(r) {
        console.log(r);
      return resolve(r);
    }, function(e) {
      return reject(e);
    });
  }).then(function(r) {
    var rent_rec = r.records[0];
    return new Promise(function(resolve, reject) {
      var post_records = [{
        'record_number': {
          value: rent_rec['$id'].value
        },
        'order_type':{
          value: 'rent'
        }
      }];
      postRecords(APP_ID, post_records, function(r) {
        var put_records = [{
          'id': rent_rec['$id'].value,
          'record': {
            'status': {
              'value': ['rented']
            }
          }
        }];
        putRecords(MASTER_APP_ID, put_records, function(r) {
          return resolve(r);
        }, function(e) {
          return reject(e);
        });
      }, function(e) {
        return reject(e);
      });
    });
  }).then(function(r) {
    console.log(r);
    return callback(null, r);
  }).catch(function(e) {
    console.log(e);
    return callback(e);
  });
};
